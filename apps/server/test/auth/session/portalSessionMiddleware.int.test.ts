/**
 * Integration tests for the portal session middleware over real Redis: loading a session from its cookie,
 * clearing an expired one, replacing the session ID at login, and logout returning the ID token.
 *
 * Spec: AUTH-003
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  endPortalSession,
  hadStaleSessionCookie,
  portalSessionMiddleware,
  portalSessionOf,
  startPortalSession,
} from '../../../src/auth/session/portalSessionMiddleware.js';
import { newOpaqueId } from '../../../src/auth/session/opaqueIds.js';
import { SESSION_COOKIE, expiredSessionCookie } from '../../../src/auth/session/sessionCookies.js';
import { SESSION_IDLE_MS, SessionStore, sessionRedisKey } from '../../../src/auth/session/SessionStore.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { DataEncryption } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

const encryption = new DataEncryption(parseKeyring(`k1=${Buffer.alloc(32, 3).toString('base64')}`));
const ID_TOKEN = 'header.payload.signature';
const LOGIN = { userId: 'user-1', roles: ['author'] as const, hvlMember: true, studentAuthor: false };
const LOGIN_DATA = {
  ...LOGIN,
  locale: 'nb' as const,
  learnerKey: 'lk-1',
  learnerKeyYear: 2026,
  idToken: ID_TOKEN,
};

/** A tiny portal: who am I, login and logout. */
function portalApp(store: SessionStore): Express {
  const app = express();
  app.use(portalSessionMiddleware(store));
  app.get('/me', (_req, res) => {
    res.json({ userId: portalSessionOf(res)?.session.userId ?? null, stale: hadStaleSessionCookie(res) });
  });
  app.post('/login', async (_req, res) => {
    res.json({ csrfToken: (await startPortalSession(store, res, LOGIN_DATA)).session.csrfToken });
  });
  app.post('/logout', async (_req, res) => {
    res.json({ idToken: (await endPortalSession(store, res)) ?? null });
  });
  return app;
}

const createdSids: string[] = [];
const sidFrom = (res: request.Response): string => {
  const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const sid = /__Host-hvli_sid=([^;]*)/.exec(cookies.join('\n'))?.[1] ?? '';
  createdSids.push(sid);
  return sid;
};
const withSid = (sid: string): string => `${SESSION_COOKIE}=${sid}`;

describeWithServices('[AUTH-003] portal session middleware', () => {
  let redis: Redis;
  let clock = Date.now();
  let app: Express;
  let store: SessionStore;

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    store = new SessionStore({ redis, encryption, now: () => new Date(clock) });
    app = portalApp(store);
  });
  afterAll(async () => {
    await redis.del(createdSids.map(sessionRedisKey));
    await redis.quit();
  });

  it('[AUTH-003] finds no session without a cookie and sets no cookie', async () => {
    const res = await request(app).get('/me');
    expect(res.body).toEqual({ userId: null, stale: false });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('[AUTH-003] login sets one session cookie with the exact attributes, and the next request finds it', async () => {
    // Act
    const login = await request(app).post('/login');
    const sid = sidFrom(login);
    const me = await request(app).get('/me').set('Cookie', withSid(sid));
    // Assert
    expect(login.headers['set-cookie']).toEqual([`${withSid(sid)}; Path=/; Secure; HttpOnly; SameSite=Lax`]);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(me.body).toEqual({ userId: 'user-1', stale: false });
    expect(me.headers['set-cookie']).toBeUndefined();
  });

  it('[AUTH-003] login replaces the session the browser carried, and the old ID stops working', async () => {
    // Arrange
    const firstSid = sidFrom(await request(app).post('/login'));
    // Act
    const second = await request(app).post('/login').set('Cookie', withSid(firstSid));
    const secondSid = sidFrom(second);
    // Assert
    expect(secondSid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondSid).not.toBe(firstSid);
    expect(await redis.exists(sessionRedisKey(firstSid))).toBe(0);
    expect((await request(app).get('/me').set('Cookie', withSid(firstSid))).body.userId).toBeNull();
    expect((await request(app).get('/me').set('Cookie', withSid(secondSid))).body.userId).toBe('user-1');
  });

  it('[AUTH-003] never adopts a planted session ID: login answers with a new one', async () => {
    const planted = newOpaqueId();
    const login = await request(app).post('/login').set('Cookie', withSid(planted));
    expect(sidFrom(login)).not.toBe(planted);
    expect(login.headers['set-cookie']).toHaveLength(1);
  });

  it('[AUTH-003] treats an expired session as none and clears its cookie', async () => {
    // Arrange
    const sid = sidFrom(await request(app).post('/login'));
    clock += SESSION_IDLE_MS;
    // Act
    const res = await request(app).get('/me').set('Cookie', withSid(sid));
    // Assert
    expect(res.body).toEqual({ userId: null, stale: true });
    expect(res.headers['set-cookie']).toEqual([expiredSessionCookie()]);
  });

  it('[AUTH-003] ignores a duplicated session cookie', async () => {
    const sid = sidFrom(await request(app).post('/login'));
    const res = await request(app)
      .get('/me')
      .set('Cookie', `${withSid(sid)}; ${withSid(newOpaqueId())}`);
    expect(res.body.userId).toBeNull();
  });

  it('[AUTH-003] logout returns the ID token, deletes the session and clears the cookie', async () => {
    // Arrange
    const sid = sidFrom(await request(app).post('/login'));
    // Act
    const logout = await request(app).post('/logout').set('Cookie', withSid(sid));
    const after = await request(app).get('/me').set('Cookie', withSid(sid));
    // Assert
    expect(logout.body).toEqual({ idToken: ID_TOKEN });
    expect(logout.headers['set-cookie']).toEqual([expiredSessionCookie()]);
    expect(logout.headers['cache-control']).toBe('no-store');
    expect(await redis.exists(sessionRedisKey(sid))).toBe(0);
    expect(after.body).toEqual({ userId: null, stale: true });
  });

  it('[AUTH-003] logout without a live session still clears the cookie and returns no token', async () => {
    const res = await request(app).post('/logout').set('Cookie', withSid(newOpaqueId()));
    expect(res.body).toEqual({ idToken: null });
    expect(res.headers['set-cookie']).toEqual([expiredSessionCookie()]);
  });
});

describe('[AUTH-003] portal session middleware failures', () => {
  it('[AUTH-003] fails closed: a Redis error reaches the error handler instead of passing as no session', async () => {
    // Arrange
    const failing = { get: () => Promise.reject(new Error('redis down')) } as unknown as SessionStore;
    const app = portalApp(failing);
    app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ failed: true });
    });
    // Act
    const res = await request(app).get('/me').set('Cookie', withSid(newOpaqueId()));
    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ failed: true });
  });
});
