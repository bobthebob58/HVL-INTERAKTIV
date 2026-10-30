/**
 * Integration tests of `POST /api/content/:contentId/duplicate` on the real content types (D-092 as amended): who may
 * copy which activity, and what a copy through the bank takes along and what it never does, including its
 * attribution, which only the copy's editors see.
 *
 * Spec: PROD-007, PED-030, DATA-002, DATA-007
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import type { HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { LTI_OVERRIDES } from './collaborationFixtures.js';
import { openDuplicateRouteBench, type DuplicateRouteBench } from './duplicateRouteBench.js';

const DESIGN = {
  phase: 'etterarbeid',
  patternId: 'ea-retrieval',
  estimatedStudentMinutes: 15,
  learnerPurpose: 'Du hentar fram det du lærte i går.',
  rationale: 'Gruppa mi blandar omgrepa.',
  courseCode: 'SYK110',
} as const;
const OUTCOME = { text: 'Forklare omgrepet', category: 'kunnskap', position: 0 } as const;

describeWithServices('[PROD-007] the duplicate route', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicateRouteBench;
    const sources = { listed: '', unlisted: '', draft: '' };

    beforeAll(async () => {
      bench = await openDuplicateRouteBench();
      sources.listed = await bench.importExample('H5P.ImageHotspots', true);
      sources.unlisted = await bench.importExample('H5P.ImageHotspots', true);
      await bench.tb.db.h5PContent.update({ where: { id: sources.unlisted }, data: { bankListedAt: null } });
      sources.draft = await bench.importExample('H5P.ImageHotspots', false);
    }, 180_000);
    afterAll(() => bench.close());

    const duplicate = (header: readonly [string, string], contentId: string) =>
      request(bench.api)
        .post(`/api/content/${contentId}/duplicate`)
        .set(...header);
    const ownedBy = (userId: string) => bench.tb.db.h5PContent.count({ where: { ownerUserId: userId } });

    it.each<
      [
        string,
        'owner' | 'copier' | 'student' | 'learner' | 'lti',
        keyof typeof sources | 'unknown',
        number,
        string,
      ]
    >([
      ['the owner copies their own draft through Edit', 'owner', 'draft', 201, ''],
      ['a colleague copies a bank activity', 'copier', 'listed', 201, ''],
      [
        'a colleague may not copy one that is shared but not in the bank',
        'copier',
        'unlisted',
        403,
        'hvl:duplicate-not-allowed',
      ],
      [
        'a student author may not copy through the bank',
        'student',
        'listed',
        403,
        'hvl:duplicate-not-allowed',
      ],
      ['a learner may not copy', 'learner', 'listed', 403, 'error.forbidden'],
      ['a Canvas launch may not copy', 'lti', 'listed', 401, 'hvl:unauthenticated'],
      ['a colleague’s draft is unavailable', 'copier', 'draft', 404, 'hvl:activity-unavailable'],
      ['an unknown activity is unavailable', 'copier', 'unknown', 404, 'hvl:activity-unavailable'],
    ])(
      '[PROD-007] %s',
      async (_name, who, source, status, code) => {
        // Arrange
        const extra: Record<string, () => Promise<HvlH5pActor>> = {
          student: async () => (await bench.tb.actor('author', { studentAuthor: true })).actor,
          learner: async () => (await bench.tb.actor('learner')).actor,
          lti: async () =>
            (await bench.tb.actor('author', { hvlMember: false, feideAuthenticated: false })).actor,
        };
        const actor =
          who === 'owner' ? bench.owner.actor : who === 'copier' ? bench.copier.actor : await extra[who]?.();
        if (!actor) throw new Error(`no actor ${who}`);
        const overrides: Partial<Principal> = who === 'lti' ? LTI_OVERRIDES : {};
        const before = await ownedBy(actor.accountId);
        // Act
        const res = await duplicate(
          bench.as(actor, overrides),
          source === 'unknown' ? randomUUID() : sources[source],
        );
        // Assert: an allowed copy is one new activity; a refusal writes nothing
        expect([res.status, res.body.errorCode ?? '']).toEqual([status, code]);
        expect(await ownedBy(actor.accountId)).toBe(before + (status === 201 ? 1 : 0));
      },
      60_000,
    );

    it('[PROD-007] a copy through the bank takes the content and learning design, never the author’s own planning or anything else', async () => {
      // Arrange: a bank source with metadata, learner state, an acknowledgement and a co-author
      const { db } = bench.tb;
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      const owner = bench.owner.actor.accountId;
      await db.user.update({ where: { id: owner }, data: { displayName: 'Ola Opphav' } });
      await db.learningDesignMetadata.create({
        data: { contentId: sourceId, ...DESIGN, outcomes: { create: [{ ...OUTCOME }] } },
      });
      await db.h5PUserData.create({
        data: { contentId: sourceId, dataType: 'state', learnerKey: 'k', data: {} },
      });
      const acknowledgement = { ruleId: 'V-ALT', path: 'image', reason: 'Pynt', userId: owner };
      await db.validationAcknowledgement.create({ data: { contentId: sourceId, ...acknowledgement } });
      const coAuthor = (await bench.tb.actor('author')).actor.accountId;
      await db.contentCollaborator.create({ data: { contentId: sourceId, userId: coAuthor } });
      await bench.placeInCanvas(sourceId);
      const statement = { contentVersion: 1, learnerKey: 'k', verb: 'answered', attemptId: 'a1' };
      await db.xapiStatement.create({ data: { contentId: sourceId, ...statement, timestamp: new Date() } });
      // Act
      const res = await duplicate(bench.as(bench.copier.actor), sourceId);
      // Assert: the same content and files (by their bytes) under the copier, a private unlisted draft
      expect(res.status).toBe(201);
      const copyId = (res.body as { contentId: string }).contentId;
      expect(await bench.hashedParams(copyId)).toEqual(await bench.hashedParams(sourceId));
      // WHY: the parameters name every file by its bytes above; the copy stores no file the source does not
      // (an unreferenced file in the imported package is not copied).
      const sourceFiles = (await bench.filesOf(sourceId)).map((f) => f.sha256);
      const copyFiles = (await bench.filesOf(copyId)).map((f) => f.sha256);
      expect(copyFiles.length).toBeGreaterThan(0);
      expect(sourceFiles).toEqual(expect.arrayContaining(copyFiles));
      const copy = await db.h5PContent.findUniqueOrThrow({ where: { id: copyId } });
      expect(copy).toMatchObject({
        ownerUserId: bench.copier.actor.accountId,
        status: 'draft',
        visibility: 'private',
        bankListedAt: null,
        publishedAt: null,
        sourceContentId: sourceId,
        sourceAuthorUserId: owner,
      });
      // Assert: the learning design without the rationale and course code; nothing else of the source's
      const design = await db.learningDesignMetadata.findUniqueOrThrow({
        where: { contentId: copyId },
        include: { outcomes: { select: { text: true, category: true } } },
      });
      expect(design).toMatchObject({
        phase: 'etterarbeid',
        patternId: 'ea-retrieval',
        estimatedStudentMinutes: 15,
      });
      expect(design).toMatchObject({
        learnerPurpose: DESIGN.learnerPurpose,
        rationale: null,
        courseCode: null,
      });
      expect(design.outcomes).toEqual([{ text: 'Forklare omgrepet', category: 'kunnskap' }]);
      const where = { contentId: copyId };
      const left = await Promise.all([
        db.h5PUserData.count({ where }),
        db.validationAcknowledgement.count({ where }),
        db.contentCollaborator.count({ where }),
        db.ltiPlacement.count({ where }),
        db.xapiStatement.count({ where }),
      ]);
      expect(left).toEqual([0, 0, 0, 0, 0]);
      expect(await db.ltiPlacement.count({ where: { contentId: sourceId } })).toBe(1);
      // Assert: audited with object IDs and codes; the attribution only for the copy's editors
      expect(await bench.duplicatedEvents(copyId)).toEqual([
        {
          actorUserId: bench.copier.actor.accountId,
          details: { sourceContentId: sourceId, via: 'bank', kind: 'duplicate' },
        },
      ]);
      const detail = await request(bench.api)
        .get(`/api/content/${copyId}`)
        .set(...bench.as(bench.copier.actor));
      expect(detail.body).toMatchObject({ sourceContentId: sourceId, sourceAuthorName: 'Ola Opphav' });
      const sourceAuthor = await request(bench.api)
        .get(`/api/content/${copyId}`)
        .set(...bench.as(bench.owner.actor));
      expect(sourceAuthor.status).toBe(404);
    }, 120_000);
  });
});
