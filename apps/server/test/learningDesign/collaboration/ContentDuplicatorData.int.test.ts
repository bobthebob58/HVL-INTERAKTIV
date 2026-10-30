/**
 * Integration tests of what a duplicate takes along besides the H5P content (D-092): the learning-design data, never
 * the source author's rationale and course code through the bank, never learner data, placements, acknowledgements
 * or co-authors; and the refusals, which write nothing.
 *
 * Spec: PROD-007, PED-030, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openDuplicatorBench, type DuplicatorBench } from './duplicatorBench.js';

const DESIGN = {
  phase: 'etterarbeid',
  patternId: 'ea-retrieval',
  estimatedStudentMinutes: 15,
  learnerPurpose: 'Du hentar fram det du lærte i går.',
  rationale: 'Gruppa mi blandar omgrepa.',
  courseCode: 'SYK110',
} as const;
const OUTCOMES = [
  { text: 'Forklare omgrepet', category: 'kunnskap', position: 0 },
  { text: 'Bruke modellen', category: 'ferdigheiter', position: 1 },
] as const;

describeWithServices('[PROD-007] what a duplicate takes along', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicatorBench;

    beforeAll(async () => {
      bench = await openDuplicatorBench();
    }, 180_000);
    afterAll(() => bench.close());

    const designOf = (contentId: string) =>
      bench.tb.db.learningDesignMetadata.findUnique({
        where: { contentId },
        omit: { contentId: true, updatedAt: true },
        include: { outcomes: { orderBy: { position: 'asc' }, omit: { id: true, metadataContentId: true } } },
      });

    it.each([
      ['a colleague through the bank', 'copier', 'bank', { rationale: null, courseCode: null }],
      ['the owner through Edit', 'owner', 'edit', {}],
    ] as const)(
      '[PROD-007] %s gets the learning-design data D-092 allows',
      async (_name, who, route, left) => {
        // Arrange: a bank-listed source with every learning-design field and two outcomes
        const sourceId = await bench.importExample('H5P.ImageHotspots', true);
        await bench.tb.db.learningDesignMetadata.create({
          data: { contentId: sourceId, ...DESIGN, outcomes: { create: [...OUTCOMES] } },
        });
        // Act
        const { contentId, via } = await bench.duplicator.duplicate(sourceId, bench[who].actor);
        // Assert: the source author's own planning stays with the source when copied through the bank
        expect(via).toBe(route);
        expect(await designOf(contentId)).toEqual({ ...DESIGN, ...left, outcomes: OUTCOMES });
        expect(await designOf(sourceId)).toEqual({ ...DESIGN, outcomes: OUTCOMES });
      },
      60_000,
    );

    it('[PROD-007] learner state, statements, snapshots, acknowledgements and co-authors are never copied', async () => {
      // Arrange: a source with one of each, and a co-author
      const { db } = bench.tb;
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      const coAuthor = await bench.tb.actor('author');
      const learnerKey = `learner-${randomUUID()}`;
      const at = new Date();
      await db.h5PUserData.create({ data: { contentId: sourceId, dataType: 'state', learnerKey, data: {} } });
      await db.xapiStatement.create({
        data: {
          contentId: sourceId,
          contentVersion: 1,
          learnerKey,
          verb: 'answered',
          attemptId: 'a1',
          timestamp: at,
        },
      });
      await db.insightSnapshot.create({
        data: { contentId: sourceId, periodStart: at, periodEnd: at, k: 5, aggregates: {} },
      });
      const acknowledgement = {
        ruleId: 'V-ALT',
        path: 'image',
        reason: 'Pynt',
        userId: bench.owner.actor.accountId,
      };
      await db.validationAcknowledgement.create({ data: { contentId: sourceId, ...acknowledgement } });
      await db.contentCollaborator.create({
        data: { contentId: sourceId, userId: coAuthor.actor.accountId },
      });
      // Act
      const { contentId } = await bench.duplicator.duplicate(sourceId, bench.copier.actor);
      // Assert: the copy has none of them; the source keeps all of them
      const where = { contentId };
      const counts = await Promise.all([
        db.h5PUserData.count({ where }),
        db.xapiStatement.count({ where }),
        db.insightSnapshot.count({ where }),
        db.validationAcknowledgement.count({ where }),
        db.contentCollaborator.count({ where }),
        db.ltiPlacement.count({ where }),
      ]);
      expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
      expect(await db.h5PUserData.count({ where: { contentId: sourceId } })).toBe(1);
      expect(await db.contentCollaborator.count({ where: { contentId: sourceId } })).toBe(1);
    }, 60_000);

    it.each([
      ['an unknown activity', 'unknown', 'copier', 404, 'hvl:activity-unavailable'],
      ['a colleague’s draft', 'draft', 'copier', 404, 'hvl:activity-unavailable'],
      [
        'an activity shared with HVL but not in the bank',
        'unlisted',
        'copier',
        403,
        'hvl:duplicate-not-allowed',
      ],
      ['a bank activity, by a learner', 'listed', 'learner', 403, 'hvl:duplicate-not-allowed'],
    ] as const)(
      '[PROD-007] copying %s is refused and writes nothing',
      async (_name, kind, who, status, code) => {
        // Arrange
        const sourceId =
          kind === 'unknown'
            ? randomUUID()
            : await bench.importExample('H5P.ImageHotspots', kind !== 'draft');
        if (kind === 'unlisted') {
          await bench.tb.db.h5PContent.update({ where: { id: sourceId }, data: { bankListedAt: null } });
        }
        const actor = who === 'learner' ? (await bench.tb.actor('learner')).actor : bench.copier.actor;
        const audits = () => bench.tb.db.auditEvent.count({ where: { actorUserId: actor.accountId } });
        const [before, auditsBefore] = [await bench.copierActivityIds(), await audits()];
        // Act
        const error = await bench.duplicator.duplicate(sourceId, actor).catch((e: unknown) => e);
        // Assert
        expect(error).toMatchObject({ status, errorCode: code });
        expect(await bench.newCopierRows(before)).toEqual([]);
        expect(await audits()).toBe(auditsBefore);
      },
      60_000,
    );
  });
});
