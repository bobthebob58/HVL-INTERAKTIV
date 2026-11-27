/**
 * Integration tests of the ceiling on requests to the Feide login routes from one network address (D-150), on Redis
 * and against the mock Feide: the number, the friendly refusal before a login is stored or a callback is looked
 * at, login and callback sharing one count, one address not counting for another, the address never used as a key,
 * and a login that goes ahead when Redis cannot be reached.
 *
 * Spec: AUTH-001, NFR-006
 */
import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FEIDE_LOGIN_REQUESTS_PER_MINUTE } from '../../../src/auth/feide/loginRequestCeiling.js';
import { LOGIN_COOKIE } from '../../../src/auth/session/sessionCookies.js';
import { addressFingerprint } from '../../../src/http/addressRequestCeiling.js';
import type { Redis } from '../../../src/infra/redisClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { cookiePair, openFeideTestbed, type FeideTestbed } from '../../support/feideTestbed.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[AUTH-001] the ceiling on requests to the Feide login routes from one address', () => {
  const hasher = new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS);
  const open: FeideTestbed[] = [];
  let three: FeideTestbed;
  beforeAll(async () => {
    three = await openFeideTestbed({}, { limit: 3 });
    open.push(three);
  }, 60_000);
  afterAll(() => Promise.all(open.map((tb) => tb.close())));

  const part = () => randomInt(65536).toString(16);
  /** A documentation address (RFC 3849) that no other test of this run uses. */
  const address = () => `2001:db8::${part()}:${part()}:${part()}`;
  const login = (app: Express, ip: string) =>
    request(app).get('/auth/feide/login').set('X-Forwarded-For', ip);
  const callback = (app: Express, ip: string) =>
    request(app).get('/auth/feide/callback?code=x&state=y').set('X-Forwarded-For', ip);
  const failedLogins = (since: Date) =>
    three.db.authAuditEvent.count({ where: { event: 'login.feide.failed', at: { gte: since } } });

  it('[AUTH-001] the number is 4 000 requests a minute: 2 000 logins of two requests each', () => {
    expect(FEIDE_LOGIN_REQUESTS_PER_MINUTE).toBe(4000);
  });

  it('[AUTH-001] logins up to the ceiling start; the next gets the friendly page with Retry-After and stores no login', async () => {
    // Arrange
    const [busy, other] = [address(), address()];
    // Act
    const answers = [];
    for (let n = 0; n < 5; n += 1) answers.push(await login(three.app, busy));
    const elsewhere = await login(three.app, other);
    // Assert: three logins started, two refused before a login was stored; the other address is not affected
    expect(answers.map((res) => res.status)).toEqual([302, 302, 302, 429, 429]);
    const refused = answers[3];
    expect(refused?.text).toContain('Du har sendt for mange førespurnader på kort tid.');
    expect(refused?.headers['content-type']).toMatch(/^text\/html/);
    expect(refused?.headers['cache-control']).toBe('no-store');
    expect(Number(refused?.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(refused?.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(refused?.headers.location).toBeUndefined();
    expect(refused ? cookiePair(refused, LOGIN_COOKIE) : 'none').toBeUndefined();
    expect(elsewhere.status).toBe(302);
  });

  it('[AUTH-001] login and callback share the count, and a callback past the ceiling writes nothing to the audit log', async () => {
    // Arrange
    const ip = address();
    const started = new Date();
    // Act: one login and two callbacks that are not this browser's fill the minute; a third callback follows
    const first = await login(three.app, ip);
    const stray = [await callback(three.app, ip), await callback(three.app, ip)];
    const recorded = await failedLogins(started);
    const past = await callback(three.app, ip);
    // Assert: the strays are refused as failed logins; the one past the ceiling is refused before it is looked at
    expect([first.status, ...stray.map((res) => res.status), past.status]).toEqual([302, 400, 400, 429]);
    expect(recorded).toBeGreaterThanOrEqual(1);
    expect(await failedLogins(started)).toBe(recorded);
    expect(past.text).toContain('Du har sendt for mange førespurnader på kort tid.');
  });

  it('[NFR-006] the address is counted under its keyed fingerprint, for a minute, and is never a key itself', async () => {
    // Arrange
    const ip = address();
    // Act
    await login(three.app, ip);
    // Assert
    const key = `hvli:feide-requests:${addressFingerprint(hasher, ip)}`;
    expect(await three.redis.get(key)).toBe('1');
    const ttl = await three.redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    expect(key).not.toContain(ip);
    expect(await three.redis.exists(`hvli:feide-requests:${ip}`)).toBe(0);
  });

  it('[AUTH-001] with Redis unreachable for the count, a login starts, and one line says the ceiling was not counted', async () => {
    // Arrange: a counter client whose every command fails; the logins themselves keep the real Redis
    const broken = {
      multi: () => {
        throw new Error('redis down');
      },
    } as unknown as Redis;
    const tb = await openFeideTestbed({}, { limit: 1, redis: broken });
    open.push(tb);
    // Act
    const answers = [await login(tb.app, address()), await login(tb.app, address())];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([302, 302]);
    expect(tb.logs.filter((line) => line.includes('Feide login ceiling not counted'))).toHaveLength(1);
  });
});
