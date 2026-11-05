/**
 * Integration tests for a login that races the yearly purge (D-107's amendment of 2026-11-05): the purge deletes a
 * learner's identity after the login has read it. A login that makes the account staff must not then leave a staff
 * account, with a display name, that no login reaches; it starts over as a first login, and the old learner account
 * is left for the next purge. The purge's delete is simulated at the exact moment between the read and the write.
 *
 * Spec: DATA-003, DATA-002, AUTH-004
 */
import { afterAll, expect, it } from 'vitest';
import { AccountResolver } from '../../../src/auth/identity/AccountResolver.js';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

/** The identity the simulated purge deletes; set by each test. */
const raceTarget = { id: '' };

/** The database, with the purge's identity delete run right before the named write of the login. */
function purgeBefore(db: Database, model: 'user' | 'identity', write: 'updateMany' | 'update'): Database {
  const delegate = db[model] as unknown as Record<string, (args: unknown) => Promise<unknown>>;
  const raced = new Proxy(delegate, {
    get: (target, key) =>
      key === write
        ? async (args: unknown) => {
            await db.identity.deleteMany({ where: { id: raceTarget.id } });
            return target[write]!.call(target, args);
          }
        : Reflect.get(target, key),
  });
  return new Proxy(db, { get: (target, key) => (key === model ? raced : Reflect.get(target, key)) });
}

describeWithServices('[DATA-003] a login that races the yearly purge', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const OLD = parseKeyring(`old=${randomKey(51)}`);
  const ROTATED = parseKeyring(`new=${randomKey(52)},old=${randomKey(51)}`);
  const feide = () => `feide|${uniqueName('race')}@hvl.no`;
  afterAll(() => db.$disconnect());

  it('[DATA-003] the purge deletes the identity before the login makes it staff: a new staff account, the old one left as a learner', async () => {
    // Arrange
    const source = feide();
    const learner = await new AccountResolver({ db, hasher: new IdentityHasher(OLD) }).resolve({
      provider: 'feide',
      source,
      kind: 'learner',
    });
    raceTarget.id = (await db.identity.findFirstOrThrow({ where: { userId: learner.userId } })).id;
    const racing = new AccountResolver({
      db: purgeBefore(db, 'user', 'updateMany'),
      hasher: new IdentityHasher(OLD),
    });
    // Act
    const staff = await racing.resolve({
      provider: 'feide',
      source,
      kind: 'staff',
      profile: { displayName: 'Kari' },
    });
    // Assert
    expect(staff).toMatchObject({ kind: 'staff', created: true });
    expect(staff.userId).not.toBe(learner.userId);
    const old = await db.user.findUniqueOrThrow({
      where: { id: learner.userId },
      include: { identities: true },
    });
    expect(old).toMatchObject({ kind: 'learner', displayName: null, identities: [] });
    const found = await new AccountResolver({ db, hasher: new IdentityHasher(OLD) }).lookup('feide', source);
    expect(found).toBe(staff.userId);
  });

  it('[DATA-003] the purge deletes the identity before the key rotation re-hashes it: the login creates a new account instead of failing', async () => {
    // Arrange
    const source = feide();
    const learner = await new AccountResolver({ db, hasher: new IdentityHasher(OLD) }).resolve({
      provider: 'feide',
      source,
      kind: 'learner',
    });
    raceTarget.id = (await db.identity.findFirstOrThrow({ where: { userId: learner.userId } })).id;
    const racing = new AccountResolver({
      db: purgeBefore(db, 'identity', 'update'),
      hasher: new IdentityHasher(ROTATED),
    });
    // Act
    const again = await racing.resolve({ provider: 'feide', source, kind: 'learner' });
    // Assert
    expect(again).toMatchObject({ kind: 'learner', created: true });
    expect(again.userId).not.toBe(learner.userId);
  });

  it('[DATA-003] without a purge in between, the same login makes the account found staff, as before', async () => {
    // Arrange
    const source = feide();
    const resolver = new AccountResolver({ db, hasher: new IdentityHasher(OLD) });
    const learner = await resolver.resolve({ provider: 'feide', source, kind: 'learner' });
    // Act
    const staff = await resolver.resolve({
      provider: 'feide',
      source,
      kind: 'staff',
      profile: { displayName: 'Ola' },
    });
    // Assert
    expect(staff).toEqual({ userId: learner.userId, kind: 'staff', created: false });
    expect(await db.user.findUniqueOrThrow({ where: { id: learner.userId } })).toMatchObject({
      kind: 'staff',
      displayName: 'Ola',
    });
  });
});
