/**
 * Integration tests of the ceiling on requests to ltijs's routes from one network address (D-141), on Redis: the
 * number, the refusal before the body is read, one address not counting for another, the address never used as a
 * key, and a launch that goes ahead when Redis cannot be reached.
 *
 * Spec: LTI-001, NFR-006
 */
import { randomInt } from 'node:crypto';
import express from 'express';
import { HttpMethod } from 'ltijs';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { addressFingerprint } from '../../../src/http/addressRequestCeiling.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { ExpressRouterHttpHandler } from '../../../src/lti/http/ExpressRouterHttpHandler.js';
import {
  LAUNCH_REQUESTS_PER_MINUTE,
  launchRequestCeiling,
} from '../../../src/lti/http/launchRequestCeiling.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[LTI-001] the ceiling on requests to ltijs’s routes from one address', () => {
  const env = serviceEnv();
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  let redis: Redis;
  beforeAll(async () => {
    redis = await connectRedis(env.REDIS_URL);
  });
  afterAll(() => redis.quit());

  /** ltijs's login route behind a ceiling of `limit`, on an app that takes the address from one proxy. */
  const appWith = (limit: number, client: Redis = redis) => {
    const { logger, lines } = capturedLogger('warn');
    const handled: string[] = [];
    const before = launchRequestCeiling({ redis: client, hasher, logger, limit });
    const http = new ExpressRouterHttpHandler([], {
      route: '/lti/launch',
      ownOrigin: 'https://x.test',
      before,
    });
    http.registerRoute('/lti/login', [HttpMethod.Post], async (req, res) => {
      handled.push(String(req.body.iss));
      res.json({ ok: true });
    });
    const app = express();
    app.set('trust proxy', 1);
    app.use(http.router);
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const { status, errorCode } = error as { status?: number; errorCode?: string };
      res.status(status ?? 500).send(errorCode ?? error.message);
    });
    return { app, handled, lines };
  };
  const part = () => randomInt(65536).toString(16);
  /** A documentation address (RFC 3849) that no other test of this run uses. */
  const address = () => `2001:db8::${part()}:${part()}:${part()}`;
  const login = (app: express.Express, ip: string, iss: string) =>
    request(app).post('/lti/login').set('X-Forwarded-For', ip).type('form').send({ iss });

  it('[LTI-001] the number is 6 000 requests a minute: 2 000 launches of three requests each', () => {
    expect(LAUNCH_REQUESTS_PER_MINUTE).toBe(6000);
  });

  it('[LTI-001] requests up to the ceiling pass; the next is 429 with Retry-After and is never read', async () => {
    // Arrange
    const { app, handled } = appWith(3);
    const [busy, other] = [address(), address()];
    // Act
    const answers = [];
    for (const iss of ['1', '2', '3', '4', '5']) answers.push(await login(app, busy, iss));
    const elsewhere = await login(app, other, 'other');
    // Assert: three handled, two refused before ltijs saw them, and the other address is not affected
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 429, 429]);
    expect(answers[3]?.text).toBe('hvl:rate-limited');
    expect(Number(answers[3]?.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(answers[3]?.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(elsewhere.status).toBe(200);
    expect(handled).toEqual(['1', '2', '3', 'other']);
  });

  it('[NFR-006] the address is counted under its keyed fingerprint, for a minute, and is never a key itself', async () => {
    // Arrange
    const { app } = appWith(100);
    const ip = address();
    // Act
    await login(app, ip, 'x');
    // Assert
    const key = `hvli:lti-requests:${addressFingerprint(hasher, ip)}`;
    expect(await redis.get(key)).toBe('1');
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    expect(key).not.toContain(ip);
    expect(await redis.exists(`hvli:lti-requests:${ip}`)).toBe(0);
    expect(addressFingerprint(hasher, undefined)).toBe(addressFingerprint(hasher, 'no-address'));
  });

  it('[LTI-001] with Redis unreachable the request goes ahead, and one line says the ceiling was not counted', async () => {
    // Arrange: a client whose every command fails
    const broken = {
      multi: () => {
        throw new Error('redis down');
      },
    } as unknown as Redis;
    const { app, handled, lines } = appWith(1, broken);
    // Act
    const answers = [await login(app, address(), 'a'), await login(app, address(), 'b')];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([200, 200]);
    expect(handled).toEqual(['a', 'b']);
    expect(lines.filter((line) => line.includes('LTI request ceiling not counted'))).toHaveLength(1);
  });
});
