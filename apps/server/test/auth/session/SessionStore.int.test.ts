/**
 * Integration tests for portal sessions in Redis with a fake clock: a new ID at every create, what the raw Redis
 * value may hold, idle (2 h) and absolute (12 h) expiry, sliding, and logout returning the ID token once.
 *
 * Spec: AUTH-003
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  SESSION_KEY_PREFIX,
  SessionStore,
  sessionRedisKey,
  type NewPortalSession,
} from '../../../src/auth/session/SessionStore.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { DataEncryption, DecryptionError } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ID_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJuYW1lIjoiS2FyaSBOb3JkbWFubiJ9.c2lnbmF0dXJl';
const encryption = (fill: number) =>
  new DataEncryption(parseKeyring(`k${fill}=${Buffer.alloc(32, fill).toString('base64')}`));
const LOGIN: NewPortalSession = {
  userId: 'user-1',
  roles: ['author', 'author'],
  hvlMember: true,
  studentAuthor: false,
  locale: 'nn',
  learnerKey: 'learner-key-1',
  idToken: ID_TOKEN,
};

describeWithServices('[AUTH-003] portal sessions in Redis', () => {
  let redis: Redis;
  const sids: string[] = [];

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
  });
  afterAll(async () => {
    if (sids.length > 0) await redis.del(sids.map(sessionRedisKey));
    await redis.quit();
  });

  /** A store on a fake clock, and a login through it. */
  const testbed = (fill = 1) => {
    let clock = new Date('2026-10-23T08:00:00Z').getTime();
    const store = new SessionStore({ redis, encryption: encryption(fill), now: () => new Date(clock) });
    const login = async () => {
      const created = await store.create(LOGIN);
      sids.push(created.sid);
      return created;
    };
    return { store, login, advance: (ms: number) => (clock += ms), now: () => clock };
  };

  it('[AUTH-003] gives every login a new random session ID and CSRF token, never reusing one', async () => {
    // Arrange
    const { store, login } = testbed();
    // Act
    const first = await login();
    const second = await login();
    // Assert
    expect(first.sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.sid).not.toBe(first.sid);
    expect(second.csrfToken).not.toBe(first.csrfToken);
    expect(await store.get(first.sid)).toMatchObject({ userId: 'user-1', roles: ['author'], locale: 'nn' });
    expect(await store.get(second.sid)).toMatchObject({ csrfToken: second.csrfToken, hvlMember: true });
  });

  it('[AUTH-003] stores neither the session ID nor the ID token: only the inventory fields, keyed by a hash', async () => {
    // Arrange
    const { login } = testbed();
    const { sid } = await login();
    // Act
    const keys = await redis.keys(`${SESSION_KEY_PREFIX}*`);
    const raw = (await redis.get(sessionRedisKey(sid))) ?? '';
    // Assert
    expect(keys.some((key) => key.includes(sid))).toBe(false);
    expect(keys).toContain(sessionRedisKey(sid));
    expect(raw).not.toContain(sid);
    for (const part of ID_TOKEN.split('.')) expect(raw).not.toContain(part);
    expect(raw).not.toContain(Buffer.from(ID_TOKEN).toString('base64'));
    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual(
      ['createdAt', 'csrfToken', 'hvlMember', 'idTokenEncrypted', 'lastSeenAt', 'learnerKey']
        .concat(['locale', 'roles', 'studentAuthor', 'userId'])
        .sort(),
    );
  });

  it('[AUTH-003] seals the ID token for the session-id-token purpose only (D-021, D-056)', async () => {
    // Arrange
    const { login } = testbed();
    const { sid } = await login();
    const raw = JSON.parse((await redis.get(sessionRedisKey(sid))) ?? '{}') as { idTokenEncrypted: string };
    // Act
    const sealed = Buffer.from(raw.idTokenEncrypted, 'base64');
    // Assert
    expect(sealed.toString('base64')).toBe(raw.idTokenEncrypted);
    expect(encryption(1).decrypt('session-id-token', sealed).toString('utf8')).toBe(ID_TOKEN);
    expect(() => encryption(1).decrypt('lti-access-token', sealed)).toThrow(DecryptionError);
  });

  it('[AUTH-003] ends a session after exactly 2 h without a request and deletes its key', async () => {
    // Arrange
    const { store, login, advance } = testbed();
    const { sid } = await login();
    // Act
    advance(SESSION_IDLE_MS - 1);
    const justInTime = await store.get(sid);
    advance(SESSION_IDLE_MS);
    const idle = await store.get(sid);
    // Assert
    expect(justInTime).toBeDefined();
    expect(idle).toBeUndefined();
    expect(await redis.exists(sessionRedisKey(sid))).toBe(0);
  });

  it('[AUTH-003] slides lastSeenAt and the TTL with each request, so an active session outlives 2 h', async () => {
    // Arrange
    const { store, login, advance, now } = testbed();
    const { sid } = await login();
    // Act and assert: five requests, each just under 2 h after the previous one.
    for (let i = 0; i < 5; i += 1) {
      advance(SESSION_IDLE_MS - MINUTE);
      const session = await store.get(sid);
      expect(session?.lastSeenAt.getTime()).toBe(now());
      expect(await redis.pTTL(sessionRedisKey(sid))).toBeGreaterThan(SESSION_IDLE_MS - MINUTE);
      expect(await redis.pTTL(sessionRedisKey(sid))).toBeLessThanOrEqual(SESSION_IDLE_MS);
    }
  });

  it('[AUTH-003] ends an active session 12 h after login, and the TTL never reaches past that', async () => {
    // Arrange
    const { store, login, advance } = testbed();
    const { sid } = await login();
    // Act: a request every hour until 11 h, then two more just before and at 12 h.
    for (let hour = 1; hour <= 11; hour += 1) {
      advance(HOUR);
      expect(await store.get(sid)).toBeDefined();
    }
    const ttlAt11h = await redis.pTTL(sessionRedisKey(sid));
    advance(HOUR - 1);
    const lastMoment = await store.get(sid);
    advance(1);
    const atTwelve = await store.get(sid);
    // Assert
    expect(ttlAt11h).toBeLessThanOrEqual(HOUR);
    expect(ttlAt11h).toBeGreaterThan(HOUR - MINUTE);
    expect(lastMoment).toBeDefined();
    expect(atTwelve).toBeUndefined();
    expect(SESSION_ABSOLUTE_MS).toBe(12 * HOUR);
    expect(await redis.exists(sessionRedisKey(sid))).toBe(0);
  });

  it('[AUTH-003] logout returns the ID token once and removes the key', async () => {
    // Arrange
    const { store, login } = testbed();
    const { sid } = await login();
    // Act
    const token = await store.destroy(sid);
    const again = await store.destroy(sid);
    // Assert
    expect(token).toBe(ID_TOKEN);
    expect(again).toBeUndefined();
    expect(await store.get(sid)).toBeUndefined();
    expect(await redis.exists(sessionRedisKey(sid))).toBe(0);
  });

  it('[AUTH-003] logout of an expired or unreadable session returns no token and still removes the key', async () => {
    // Arrange
    const expiredBed = testbed();
    const expired = await expiredBed.login();
    expiredBed.advance(SESSION_IDLE_MS);
    const unreadable = await testbed(1).login();
    // Act: the second store's key ring no longer holds the key that sealed the token.
    const fromExpired = await expiredBed.store.destroy(expired.sid);
    const fromUnreadable = await testbed(2).store.destroy(unreadable.sid);
    // Assert
    expect(fromExpired).toBeUndefined();
    expect(fromUnreadable).toBeUndefined();
    expect(await redis.exists([sessionRedisKey(expired.sid), sessionRedisKey(unreadable.sid)])).toBe(0);
  });
});
