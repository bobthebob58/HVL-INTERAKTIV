/**
 * Integration tests of the co-author routes (D-090 as amended): who may list, add and remove co-authors, who may be
 * added, the limit of 20, idempotent changes and the audit trail with user IDs only.
 *
 * Spec: PROD-007, DATA-007, H5P-006
 */
import { coAuthorListSchema, MAX_COAUTHORS } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  COAUTHOR_ADDED_ACTION,
  COAUTHOR_REMOVED_ACTION,
} from '../../../src/learningDesign/collaboration/coAuthorChanges.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { LTI_OVERRIDES, NEVER_FINDABLE, personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();

describeWithServices('[PROD-007] co-authors', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  let colleague: TestPrincipal;
  const path = (contentId: string, userId = '') =>
    `/api/content/${contentId}/coauthors${userId ? `/${userId}` : ''}`;
  const add = (who: TestPrincipal, contentId: string, userId: string) =>
    requestAs(tb.app, who, 'post', path(contentId)).send({ userId });
  const remove = (who: TestPrincipal, contentId: string, userId: string) =>
    requestAs(tb.app, who, 'delete', path(contentId, userId));
  const coAuthorIds = async (contentId: string) =>
    (await tb.db.contentCollaborator.findMany({ where: { contentId }, select: { userId: true } })).map(
      (c) => c.userId,
    );
  const events = (contentId: string) =>
    tb.db.auditEvent.findMany({
      where: { targetId: contentId, action: { in: [COAUTHOR_ADDED_ACTION, COAUTHOR_REMOVED_ACTION] } },
      orderBy: { at: 'asc' },
      select: { actorUserId: true, action: true, details: true },
    });

  beforeAll(async () => {
    owner = await personNamed(tb, `Eigar ${TOKEN}`);
    colleague = await personNamed(tb, `Kollega ${TOKEN}`);
  });
  afterAll(() => tb.close());

  it('[PROD-007] the owner adds a findable colleague once, and every change is audited with user IDs only', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    // Act: add twice (the second changes nothing), then remove twice
    const added = await add(owner, contentId, colleague.principal.userId);
    const again = await add(owner, contentId, colleague.principal.userId);
    const listed = await requestAs(tb.app, colleague, 'get', path(contentId));
    const removed = await remove(owner, contentId, colleague.principal.userId);
    const removedAgain = await remove(owner, contentId, colleague.principal.userId);
    // Assert: the answers are the list after each change
    expect([added.status, again.status, removed.status, removedAgain.status]).toEqual([200, 200, 200, 200]);
    expect(coAuthorListSchema.parse(added.body)).toEqual({
      owner: { userId: owner.principal.userId, displayName: `Eigar ${TOKEN}` },
      coAuthors: [{ userId: colleague.principal.userId, displayName: `Kollega ${TOKEN}`, isSelf: false }],
      mayManage: true,
    });
    expect(listed.body).toMatchObject({ mayManage: false, coAuthors: [{ isSelf: true }] });
    expect(removed.body).toMatchObject({ coAuthors: [] });
    // Assert: one event per real change, naming the actor and the co-author's ID, nothing else
    expect(await events(contentId)).toEqual([
      {
        actorUserId: owner.principal.userId,
        action: COAUTHOR_ADDED_ACTION,
        details: { userId: colleague.principal.userId },
      },
      {
        actorUserId: owner.principal.userId,
        action: COAUTHOR_REMOVED_ACTION,
        details: { userId: colleague.principal.userId },
      },
    ]);
  });

  it.each(NEVER_FINDABLE.map((row) => row.kind))('[PROD-007] %s cannot be added', async (kind) => {
    // Arrange
    const row = NEVER_FINDABLE.find((r) => r.kind === kind);
    const person = await personNamed(tb, `Ikkje ${TOKEN}`, {
      role: row?.role ?? 'author',
      searchableAt: row?.searchableAt ?? null,
      ...(row?.overrides ? { overrides: row.overrides } : {}),
    });
    const contentId = await tb.content(owner.principal.userId);
    // Act
    const res = await add(owner, contentId, person.principal.userId);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([400, 'hvl:coauthor-not-eligible']);
    expect(await coAuthorIds(contentId)).toEqual([]);
  });

  it('[PROD-007] the owner cannot add themself, nor an account that does not exist', async () => {
    const contentId = await tb.content(owner.principal.userId);
    const self = await add(owner, contentId, owner.principal.userId);
    const unknown = await add(owner, contentId, crypto.randomUUID());
    expect([self.status, self.body.errorCode]).toEqual([400, 'hvl:coauthor-not-eligible']);
    expect([unknown.status, unknown.body.errorCode]).toEqual([400, 'hvl:coauthor-not-eligible']);
  });

  it(`[PROD-007] an activity has at most ${MAX_COAUTHORS} co-authors, also when the last two arrive at once`, async () => {
    // Arrange: one place left
    const contentId = await tb.content(owner.principal.userId);
    const people: TestPrincipal[] = [];
    for (let n = 0; n <= MAX_COAUTHORS; n += 1) people.push(await personNamed(tb, `Mange ${TOKEN} ${n}`));
    for (const person of people.slice(0, MAX_COAUTHORS - 1))
      await add(owner, contentId, person.principal.userId);
    // Act: the last two at the same moment
    const answers = await Promise.all(people.slice(-2).map((p) => add(owner, contentId, p.principal.userId)));
    // Assert: exactly one is refused, and the stored list holds 20
    expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(answers.find((res) => res.status === 409)?.body.errorCode).toBe('hvl:coauthor-limit');
    expect(await coAuthorIds(contentId)).toHaveLength(MAX_COAUTHORS);
  });

  it('[PROD-007] a co-author removes only themself; viewers, other co-authors and strangers are refused', async () => {
    // Arrange: a published activity shared with HVL, with two co-authors
    const other = await personNamed(tb, `Annan ${TOKEN}`);
    const viewer = await personNamed(tb, `Lesar ${TOKEN}`);
    const contentId = await tb.content(owner.principal.userId, {
      status: 'published',
      visibility: 'organisation',
      coAuthors: [colleague.principal.userId, other.principal.userId],
    });
    const hidden = await tb.content(owner.principal.userId);
    // Act
    const removesOther = await remove(colleague, contentId, other.principal.userId);
    const removesOwner = await remove(colleague, contentId, owner.principal.userId);
    const viewerAdds = await add(viewer, contentId, viewer.principal.userId);
    const viewerLists = await requestAs(tb.app, viewer, 'get', path(contentId));
    const coAuthorAdds = await add(colleague, contentId, viewer.principal.userId);
    const strangerRemoves = await remove(viewer, hidden, owner.principal.userId);
    const removesSelf = await remove(colleague, contentId, colleague.principal.userId);
    // Assert
    const codes = [removesOther, removesOwner, viewerAdds, viewerLists, coAuthorAdds, strangerRemoves].map(
      (res) => [res.status, res.body.errorCode],
    );
    expect(codes).toEqual([
      [403, 'hvl:owner-only'],
      [403, 'hvl:owner-only'],
      [403, 'hvl:owner-only'],
      [403, 'hvl:edit-not-allowed'],
      [403, 'hvl:owner-only'],
      [404, 'hvl:activity-unavailable'],
    ]);
    expect(removesSelf.status).toBe(200);
    expect(await coAuthorIds(contentId)).toEqual([other.principal.userId]);
  });

  it.each([
    ['a student author who owns it', { overrides: { studentAuthor: true } }, 403, 'hvl:sharing-not-allowed'],
    ['an owner launched from Canvas (ltik)', { overrides: LTI_OVERRIDES }, 401, 'hvl:unauthenticated'],
  ] as const)('[PROD-007] %s may not add co-authors', async (_name, who, status, code) => {
    // Arrange
    const student = await tb.principal('author', who.overrides);
    const contentId = await tb.content(student.principal.userId);
    // Act
    const res = await add(student, contentId, colleague.principal.userId);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([status, code]);
  });
});
