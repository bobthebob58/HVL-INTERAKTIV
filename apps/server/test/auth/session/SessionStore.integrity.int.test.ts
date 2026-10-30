/**
 * Integration tests for the edges of the portal session store: a request racing a logout, malformed stored
 * values, cookie values that are not session IDs, and invalid login data.
 *
 * Spec: AUTH-003
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { newOpaqueId } from '../../../src/auth/session/opaqueIds.js';
import {
  SessionStore,
  sessionRedisKey,
  type NewPortalSession,
} from '../../../src/auth/session/SessionStore.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { DataEncryption } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

const encryption = new DataEncryption(parseKeyring(`k1=${Buffer.alloc(32, 1).toString('base64')}`));
const LOGIN: NewPortalSession = {
  userId: 'user-1',
  roles: ['learner'],
  hvlMember: false,
  studentAuthor: false,
  locale: 'en',
  learnerKey: 'learner-key-1',
  learnerKeyYear: 2026,
  idToken: 'header.payload.signature',
};

describeWithServices('[AUTH-003] session store integrity', () => {
  let redis: Redis;
  const keys: string[] = [];

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
  });
  afterAll(async () => {
    if (keys.length > 0) await redis.del(keys);
    await redis.quit();
  });

  it('[AUTH-003] a request racing a logout never brings the deleted session back', async () => {
    // Arrange: a Redis whose read is followed at once by a logout's delete, before the slide writes.
    const { sid } = await new SessionStore({ redis, encryption }).create(LOGIN);
    keys.push(sessionRedisKey(sid));
    const racing = {
      get: async (key: string) => {
        const value = await redis.get(key);
        await redis.del(key);
        return value;
      },
      set: redis.set.bind(redis),
      del: redis.del.bind(redis),
      getDel: redis.getDel.bind(redis),
    } as unknown as Redis;
    // Act
    const session = await new SessionStore({ redis: racing, encryption }).get(sid);
    // Assert
    expect(session).toBeUndefined();
    expect(await redis.exists(sessionRedisKey(sid))).toBe(0);
  });

  const { idToken: _token, ...facts } = LOGIN;
  const record = {
    ...facts,
    csrfToken: 'c',
    idTokenEncrypted: 'x',
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  it('[AUTH-003] reads a well-formed stored value (the control for the malformed cases below)', async () => {
    const sid = newOpaqueId();
    keys.push(sessionRedisKey(sid));
    await redis.set(sessionRedisKey(sid), JSON.stringify(record), { PX: 60_000 });
    expect(await new SessionStore({ redis, encryption }).get(sid)).toMatchObject({ userId: 'user-1' });
  });

  it.each([
    ['not JSON', '{"userId":'],
    ['missing fields', JSON.stringify({ userId: 'user-1', roles: ['author'] })],
    ['an unknown role', JSON.stringify({ ...record, roles: ['owner'] })],
    ['an unknown locale', JSON.stringify({ ...record, locale: 'sv' })],
    ['a time that is not a number', JSON.stringify({ ...record, createdAt: 'yesterday' })],
    ['no academic year for its learnerKey (D-107)', JSON.stringify({ ...record, learnerKeyYear: undefined })],
    ['an academic year that is not a whole number', JSON.stringify({ ...record, learnerKeyYear: 2026.5 })],
  ])('[AUTH-003] treats a stored value with %s as no session and deletes it', async (_case, value) => {
    // Arrange
    const sid = newOpaqueId();
    keys.push(sessionRedisKey(sid));
    await redis.set(sessionRedisKey(sid), value, { PX: 60_000 });
    // Act
    const session = await new SessionStore({ redis, encryption }).get(sid);
    // Assert
    expect(session).toBeUndefined();
    expect(await redis.exists(sessionRedisKey(sid))).toBe(0);
  });
});

describe('[AUTH-003] session store input checks', () => {
  const unusedRedis = new Proxy({} as Redis, {
    get: () => {
      throw new Error('Redis must not be called');
    },
  });
  const store = new SessionStore({ redis: unusedRedis, encryption });

  it('[AUTH-003] answers no session for a cookie value that is not an opaque ID, without asking Redis', async () => {
    for (const sid of ['', 'short', 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}/`]) {
      expect(await store.get(sid)).toBeUndefined();
      expect(await store.destroy(sid)).toBeUndefined();
    }
  });

  it('[AUTH-003] refuses to create a session without an ID token or with an unknown role', async () => {
    // WHY: the schema must refuse the role; the Redis stub above would also throw, so a bare toThrow() proves nothing.
    await expect(store.create({ ...LOGIN, idToken: '' })).rejects.toThrow(TypeError);
    await expect(store.create({ ...LOGIN, roles: ['owner' as 'author'] })).rejects.toBeInstanceOf(ZodError);
    await expect(store.create({ ...LOGIN, userId: '' })).rejects.toBeInstanceOf(ZodError);
  });
});
