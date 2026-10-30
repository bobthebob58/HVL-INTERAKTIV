/**
 * Integration tests of `User.coAuthorSearchableAt` (D-090 as amended): each Feide login sets it for an HVL staff
 * author and clears it for everyone else, and an LTI launch never touches it.
 *
 * Spec: PROD-007, AUTH-002, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FeideUserSpec } from '../../../../../tools/mock-platform/feideTypes.d.mts';
import { AccountResolver } from '../../../src/auth/identity/AccountResolver.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { loginWithFeide, openFeideTestbed, type FeideTestbed } from '../../support/feideTestbed.js';
import { accountOfFeideUser } from '../../support/runFeideAuthor.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

const ADMIN_ONLY_ID = `w4-admin-${randomUUID().slice(0, 8)}@hvl.no`;

describeWithServices('[PROD-007] who a Feide login makes findable as a co-author', () => {
  let tb: FeideTestbed;
  const userIds: string[] = [];

  beforeAll(async () => {
    tb = await openFeideTestbed({ adminFeideIds: [ADMIN_ONLY_ID] });
  }, 60_000);
  afterAll(async () => {
    await tb.db.authAuditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await tb.db.user.deleteMany({ where: { id: { in: userIds } } });
    await tb.close();
  });

  /** Adds a mock Feide user with a fresh Feide ID, signs them in and returns their account's stored date. */
  const signIn = async (spec: FeideUserSpec) => {
    tb.feide.addUser({ feideId: `w4-${spec.key}-${randomUUID().slice(0, 8)}@hvl.no`, ...spec });
    const { res } = await loginWithFeide(tb, spec.key);
    expect(res.status).toBe(303);
    const userId = await accountOfFeideUser(tb.db, serviceEnv(), tb.feide, spec.key);
    if (!userIds.includes(userId)) userIds.push(userId);
    return tb.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, kind: true, coAuthorSearchableAt: true },
    });
  };

  it('[PROD-007] an HVL staff author becomes findable at the login time', async () => {
    // Arrange
    const before = Date.now();
    // Act
    const user = await signIn({ key: `staff-${randomUUID()}`, affiliations: ['member', 'employee'] });
    // Assert
    expect(user.kind).toBe('staff');
    expect(user.coAuthorSearchableAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it.each([
    [
      'a student author',
      { affiliations: ['member', 'student'], groups: ['fc:fs:fs:emne:hvl.no:PPU101:1'] },
      'staff',
    ],
    ['a learner', { affiliations: ['member', 'student'] }, 'learner'],
    ['an admin-only HVL member', { affiliations: ['member'], feideId: ADMIN_ONLY_ID }, 'staff'],
  ] as const)('[PROD-007] %s is never findable', async (_name, spec, kind) => {
    // Act
    const groups = 'groups' in spec ? [...spec.groups] : [];
    const user = await signIn({
      key: `other-${randomUUID()}`,
      ...spec,
      affiliations: [...spec.affiliations],
      groups,
    });
    // Assert
    expect(user).toMatchObject({ kind, coAuthorSearchableAt: null });
  });

  it('[PROD-007] a later login without a staff affiliation clears the date', async () => {
    // Arrange: a staff author who has signed in once
    const key = `leaver-${randomUUID()}`;
    const feideId = `w4-leaver-${randomUUID().slice(0, 8)}@hvl.no`;
    const first = await signIn({ key, feideId, affiliations: ['member', 'employee'] });
    expect(first.coAuthorSearchableAt).not.toBeNull();
    // Act: the same Feide ID, now only an affiliate
    const second = await signIn({ key, feideId, affiliations: ['affiliate'] });
    // Assert: still the same staff account (never downgraded), no longer findable
    expect(second).toMatchObject({ id: first.id, kind: 'staff', coAuthorSearchableAt: null });
  });

  it('[PROD-007] an LTI launch never sets or clears the date', async () => {
    // Arrange: a findable account that also has an LTI identity
    const resolver = new AccountResolver({
      db: tb.db,
      hasher: new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS),
    });
    const source = `lti|https://canvas.example|${randomUUID()}`;
    const fresh = await resolver.resolve({
      provider: 'lti',
      source,
      kind: 'staff',
      coAuthorSearchableAt: new Date(),
    });
    userIds.push(fresh.userId);
    const read = () => tb.db.user.findUniqueOrThrow({ where: { id: fresh.userId } });
    const created = (await read()).coAuthorSearchableAt;
    const searchableAt = new Date('2026-10-01T08:00:00.000Z');
    await tb.db.user.update({ where: { id: fresh.userId }, data: { coAuthorSearchableAt: searchableAt } });
    // Act: launches that state either value
    await resolver.resolve({ provider: 'lti', source, kind: 'staff', coAuthorSearchableAt: null });
    await resolver.resolve({ provider: 'lti', source, kind: 'learner' });
    // Assert: creating through LTI wrote nothing, and later launches left the date as it was
    expect(created).toBeNull();
    expect((await read()).coAuthorSearchableAt).toEqual(searchableAt);
  });
});
