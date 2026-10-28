/**
 * Integration tests on PostgreSQL for the content facts behind H5P-006 and the data-subject audit log:
 * owner, co-authors, status, visibility and bank listing in one query; unknown and malformed IDs; every visibility
 * level and a change of it through HvlPermissionSystem; one AuditEvent per granted data-subject access.
 *
 * Spec: H5P-006, PROD-004, PROD-006, PROD-007, DATA-007
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContentPermission, UserDataPermission } from '@lumieducation/h5p-server';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { HvlPermissionSystem } from '../../../src/h5p/HvlPermissionSystem.js';
import { asAccountUser, asStateUser, type HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import {
  PrismaContentAccessRepository,
  type ContentVisibility,
} from '../../../src/h5p/permissions/ContentAccessRepository.js';
import {
  DATA_SUBJECT_ACCESS_ACTION,
  PrismaUserDataAccessAuditor,
} from '../../../src/h5p/permissions/UserDataAccessAuditor.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const ROLES = ['owner', 'coAuthor', 'colleague', 'admin'] as const;

/** Wraps the client so the test sees which model operations the repository calls. */
function recording(db: Database, calls: string[]): Database {
  return new Proxy(db, {
    get(target, model) {
      const delegate: unknown = Reflect.get(target, model);
      if (typeof model !== 'string' || typeof delegate !== 'object' || delegate === null) return delegate;
      return new Proxy(delegate, {
        get: (d, op) => (calls.push(`${model}.${String(op)}`), Reflect.get(d, op)),
      });
    },
  });
}

describeWithServices('[H5P-006] content facts and data-subject audit on PostgreSQL', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const repository = new PrismaContentAccessRepository(db);
  const auditor = new PrismaUserDataAccessAuditor(db);
  const system = new HvlPermissionSystem({ content: repository, auditor });
  const ids = {} as Record<(typeof ROLES)[number], string>;
  let contentId: string;
  let draftId: string;

  const actor = (accountId: string, extra: Partial<HvlH5pActor> = {}): HvlH5pActor => ({
    accountId,
    role: 'learner',
    learnerKey: uniqueName('learner'),
    contextId: '',
    locale: 'nn',
    hvlMember: false,
    feideAuthenticated: false,
    ltiLaunchContentIds: [],
    ...extra,
  });
  const mayView = (a: HvlH5pActor, id = contentId) =>
    system.checkForContent(asStateUser(a), ContentPermission.View, id);

  beforeAll(async () => {
    for (const role of ROLES) ids[role] = (await db.user.create({ data: { kind: 'staff' } })).id;
    const base = {
      mainLibrary: 'H5P.MultiChoice',
      title: 'Test',
      params: {},
      metadata: {},
      ownerUserId: ids.owner,
    };
    const content = await db.h5PContent.create({
      data: { ...base, status: 'published', visibility: 'organisation', bankListedAt: new Date() },
    });
    contentId = content.id;
    await db.contentCollaborator.create({ data: { contentId, userId: ids.coAuthor } });
    draftId = (await db.h5PContent.create({ data: base })).id;
  });

  afterAll(async () => {
    await db.auditEvent.deleteMany({ where: { actorUserId: { in: Object.values(ids) } } });
    await db.h5PContent.deleteMany({ where: { ownerUserId: ids.owner } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await db.$disconnect();
  });

  it('[H5P-006] reads owner, co-authors, status, visibility and bank listing with one findUnique', async () => {
    const calls: string[] = []; // Arrange
    const facts = await new PrismaContentAccessRepository(recording(db, calls)).factsFor(contentId); // Act and assert
    expect(facts).toEqual({
      contentId,
      ownerUserId: ids.owner,
      coAuthorIds: [ids.coAuthor],
      status: 'published',
      visibility: 'organisation',
      bankListed: true,
    });
    expect(calls).toEqual(['h5PContent.findUnique']);
    expect(await repository.factsFor(draftId)).toMatchObject({
      coAuthorIds: [],
      status: 'draft',
      visibility: 'private',
      bankListed: false,
    });
  });

  it('[H5P-006] an unknown activity has no facts; an upper-case ID finds the activity by its stored ID', async () => {
    expect(await repository.factsFor(randomUUID())).toBeUndefined();
    expect((await repository.factsFor(contentId.toUpperCase()))?.contentId).toBe(contentId);
  });

  it('[H5P-006] a content ID that is not a UUID is unknown and never reaches the database', async () => {
    const untouchable = new Proxy({} as Database, {
      get: () => {
        throw new Error('the database must not be queried');
      },
    });
    const guarded = new PrismaContentAccessRepository(untouchable);
    const malformed = ['', 'not-a-uuid', `${contentId}\n`, ` ${contentId}`, `${contentId}' OR '1'='1`];
    malformed.push('a'.repeat(100_000), contentId.replaceAll('-', ''), `{${contentId}}`);
    for (const id of [...malformed, 42, null, undefined] as string[]) {
      expect(await guarded.factsFor(id)).toBeUndefined(); // Act and assert
    }
  });

  it('[PROD-006] each visibility level is enforced from the database, and a change applies at once', async () => {
    const hvlOnly = actor(randomUUID(), { hvlMember: true }); // Arrange
    const feideOnly = actor(randomUUID(), { feideAuthenticated: true });
    const colleague = actor(ids.colleague, { role: 'author', hvlMember: true, feideAuthenticated: true });
    const coAuthor = actor(ids.coAuthor, { role: 'author' });
    const expected: Record<ContentVisibility, boolean[]> = {
      private: [false, false, false, true],
      organisation: [true, false, true, true],
      feide: [false, true, true, true],
    };
    for (const [visibility, allowed] of Object.entries(expected)) {
      await db.h5PContent.update({
        where: { id: contentId },
        data: { visibility: visibility as ContentVisibility },
      });
      const seen = await Promise.all([hvlOnly, feideOnly, colleague, coAuthor].map((a) => mayView(a))); // Act
      expect({ visibility, seen }).toEqual({ visibility, seen: allowed }); // Assert
    }
    await db.h5PContent.update({ where: { id: contentId }, data: { visibility: 'organisation' } });
  });

  it('[PROD-004] a draft is hidden from learners even through an LTI launch, but its authors preview it', async () => {
    const reachesEverything = { hvlMember: true, feideAuthenticated: true };
    const launched = actor(randomUUID(), { ...reachesEverything, ltiLaunchContentIds: [draftId] });
    expect(await mayView(launched, draftId)).toBe(false);
    expect(await mayView(actor(ids.owner, { role: 'author' }), draftId)).toBe(true);
    expect(await mayView(actor(ids.colleague, { role: 'author', hvlMember: true }), draftId)).toBe(false);
    expect(await mayView(actor(ids.admin, { role: 'admin' }), draftId)).toBe(true);
  });

  it('[DATA-007] writes one AuditEvent per granted data-subject access and none for a denial', async () => {
    const learnerKey = uniqueName('learner'); // Arrange
    const requestId = uniqueName('dsr');
    const admin = asAccountUser(
      actor(ids.admin, { role: 'admin', dataSubjectRequest: { requestId, learnerKey } }),
    );
    const { ViewState, DeleteState, ViewFinished } = UserDataPermission;
    expect(await system.checkForUserData(admin, ViewState, contentId, learnerKey)).toBe(true); // Act and assert
    expect(await system.checkForUserData(admin, DeleteState, undefined, learnerKey)).toBe(true);
    expect(await system.checkForUserData(admin, ViewFinished, contentId, learnerKey)).toBe(false);
    expect(await system.checkForUserData(admin, ViewState, contentId, uniqueName('other'))).toBe(false);
    expect(await system.checkForUserData(admin, DeleteState, contentId, undefined)).toBe(false);
    const events = await db.auditEvent.findMany({
      where: { actorUserId: ids.admin },
      select: { actorUserId: true, action: true, targetType: true, targetId: true, details: true },
    });
    const row = {
      actorUserId: ids.admin,
      action: DATA_SUBJECT_ACCESS_ACTION,
      targetType: 'learner',
      targetId: learnerKey,
    };
    // PRIVACY: exactly these fields and detail keys; no name, e-mail or free text reaches the audit (DATA-007).
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        { ...row, details: { requestId, contentId, permission: 'ViewState' } },
        { ...row, details: { requestId, contentId: null, permission: 'DeleteState' } },
      ]),
    );
  });

  it('[DATA-007] when the audit row cannot be written, the check rejects and nothing is stored', async () => {
    const learnerKey = uniqueName('learner');
    const broken = actor('not-a-uuid', { role: 'admin', dataSubjectRequest: { requestId: 'r', learnerKey } });
    const check = system.checkForUserData(
      asStateUser(broken),
      UserDataPermission.ViewState,
      contentId,
      learnerKey,
    );
    await expect(check).rejects.toThrow();
    expect(await db.auditEvent.count({ where: { targetId: learnerKey } })).toBe(0);
  });
});
