/**
 * Unit tests for the account resolver's choices on a fake database: which row wins when one person has rows under
 * several keys, and that a colliding re-hash keeps the login working (D-055 rotation with mixed key rings).
 *
 * Spec: DATA-002
 */
import { describe, expect, it, vi } from 'vitest';
import { AccountResolver } from '../../../src/auth/identity/AccountResolver.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';

const hasher = new IdentityHasher(parseKeyring(`new=${randomKey(41)},old=${randomKey(42)}`));
const row = (id: string, userId: string, subjectKeyId: string) => ({
  id,
  userId,
  subjectKeyId,
  user: { kind: 'learner' },
});

/** A database whose identity rows and re-hash answer are given; it records every update. */
function fakeDb(rows: ReturnType<typeof row>[], update: () => Promise<unknown>) {
  const db = {
    identity: { findMany: vi.fn(async () => rows), update: vi.fn(update) },
    user: { update: vi.fn(async () => ({})), create: vi.fn() },
  };
  return { db, resolver: new AccountResolver({ db: db as unknown as Database, hasher }) };
}
const request = { provider: 'feide', source: 'feide|kari@hvl.no', kind: 'learner' } as const;

describe('[DATA-002] account resolver with rows under several keys', () => {
  it('[DATA-002] a re-hash that collides with a newer row keeps the login on the row found', async () => {
    const { resolver } = fakeDb([row('r1', 'u1', 'old')], async () => Promise.reject({ code: 'P2002' }));
    await expect(resolver.resolve(request)).resolves.toEqual({
      userId: 'u1',
      kind: 'learner',
      created: false,
    });
  });

  it('[DATA-002] any other failure of the re-hash is not swallowed', async () => {
    const { resolver } = fakeDb([row('r1', 'u1', 'old')], async () => Promise.reject(new Error('db down')));
    await expect(resolver.resolve(request)).rejects.toThrow('db down');
  });

  it('[DATA-002] the row under the current key wins, even when an older row comes first, and nothing is re-hashed', async () => {
    // Arrange: rows come oldest first, as the lookup asks the database for them
    const { db, resolver } = fakeDb([row('r1', 'u-old', 'old'), row('r2', 'u-new', 'new')], async () => ({}));
    // Act
    const account = await resolver.resolve(request);
    // Assert
    expect(account.userId).toBe('u-new');
    expect(db.identity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
    expect(db.identity.update).not.toHaveBeenCalled();
    expect(await resolver.lookup('feide', request.source)).toBe('u-new');
  });

  it('[DATA-002] without a current-key row the oldest row wins and is re-hashed with the current key', async () => {
    // Arrange
    const { db, resolver } = fakeDb(
      [row('r1', 'u-first', 'k1'), row('r2', 'u-second', 'k2')],
      async () => ({}),
    );
    // Act
    const account = await resolver.resolve(request);
    // Assert
    expect(account.userId).toBe('u-first');
    expect(db.identity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ subjectKeyId: 'new' }),
      }),
    );
  });
});
