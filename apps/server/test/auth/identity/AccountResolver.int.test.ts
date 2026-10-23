/**
 * Integration tests for finding and creating accounts by identity hash, with key rotation, kind upgrades and
 * concurrent first logins.
 *
 * Spec: DATA-002, AUTH-004, AUTH-001
 */
import { afterAll, expect, it } from 'vitest';
import { AccountResolver } from '../../../src/auth/identity/AccountResolver.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

describeWithServices('[DATA-002] accounts by identity hash', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const OLD = parseKeyring(`old=${randomKey(11)}`);
  const ROTATED = parseKeyring(`new=${randomKey(12)},old=${randomKey(11)}`);
  const resolver = (ring = OLD) => new AccountResolver({ db, hasher: new IdentityHasher(ring) });
  const feide = () => `feide|${uniqueName('ola')}@hvl.no`;
  afterAll(() => db.$disconnect());

  it('[DATA-002] creates a learner once, without a profile, and finds it again by hash only', async () => {
    // Arrange
    const source = feide();
    const profile = { displayName: 'Ola Nordmann', email: 'ola@hvl.no' };
    // Act
    const first = await resolver().resolve({ provider: 'feide', source, kind: 'learner', profile });
    const again = await resolver().resolve({ provider: 'feide', source, kind: 'learner' });
    // Assert
    expect(first).toMatchObject({ created: true, kind: 'learner' });
    expect(again).toEqual({ userId: first.userId, kind: 'learner', created: false });
    const user = await db.user.findUniqueOrThrow({
      where: { id: first.userId },
      include: { identities: true },
    });
    expect(user).toMatchObject({ displayName: null, email: null });
    expect(JSON.stringify(user)).not.toContain(source.slice(6));
  });

  it('[DATA-002] after a key rotation finds the old row and re-hashes it with the current key', async () => {
    // Arrange
    const source = feide();
    const { userId } = await resolver(OLD).resolve({ provider: 'feide', source, kind: 'learner' });
    // Act
    const rotated = await resolver(ROTATED).resolve({ provider: 'feide', source, kind: 'learner' });
    // Assert
    expect(rotated.userId).toBe(userId);
    const identity = await db.identity.findFirstOrThrow({ where: { userId } });
    expect(identity.subjectKeyId).toBe('new');
    expect(identity.subjectHash).toBe(new IdentityHasher(ROTATED).hash('identity-subject', source).hash);
    expect(
      (
        await resolver(parseKeyring(`new=${randomKey(12)}`)).resolve({
          provider: 'feide',
          source,
          kind: 'learner',
        })
      ).userId,
    ).toBe(userId);
  });

  it('[AUTH-004] upgrades a learner who now authors, stores the staff profile, and never downgrades', async () => {
    // Arrange
    const source = feide();
    await resolver().resolve({ provider: 'feide', source, kind: 'learner' });
    // Act
    const staff = await resolver().resolve({
      provider: 'feide',
      source,
      kind: 'staff',
      profile: { displayName: 'Kari Lærar', email: 'kari@hvl.no' },
    });
    const later = await resolver().resolve({ provider: 'feide', source, kind: 'learner' });
    // Assert
    expect(staff.kind).toBe('staff');
    expect(later.kind).toBe('staff');
    const user = await db.user.findUniqueOrThrow({ where: { id: staff.userId } });
    expect(user).toMatchObject({ kind: 'staff', displayName: 'Kari Lærar', email: 'kari@hvl.no' });
  });

  it('[AUTH-001] creates one account when the first logins of a person arrive at the same time', async () => {
    // Arrange
    const source = `lti|https://canvas.example|${uniqueName('sub')}`;
    // Act
    const results = await Promise.all(
      Array.from({ length: 8 }, () => resolver().resolve({ provider: 'lti', source, kind: 'learner' })),
    );
    // Assert
    expect(new Set(results.map((r) => r.userId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
  });

  it('[DATA-002] looks an account up without creating or re-hashing anything', async () => {
    // Arrange
    const source = feide();
    const { userId } = await resolver(OLD).resolve({ provider: 'feide', source, kind: 'learner' });
    // Act
    const found = await resolver(ROTATED).lookup('feide', source);
    const missing = await resolver().lookup('feide', feide());
    // Assert
    expect(found).toBe(userId);
    expect(missing).toBeUndefined();
    expect((await db.identity.findFirstOrThrow({ where: { userId } })).subjectKeyId).toBe('old');
  });

  it('[DATA-002] keeps Feide and LTI identities with the same source text apart', async () => {
    const source = feide();
    const a = await resolver().resolve({ provider: 'feide', source, kind: 'learner' });
    const b = await resolver().resolve({ provider: 'lti', source, kind: 'learner' });
    expect(a.userId).not.toBe(b.userId);
  });
});
