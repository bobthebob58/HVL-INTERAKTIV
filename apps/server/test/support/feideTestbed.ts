/**
 * feideTestbed — the Feide login routes on the test Redis and PostgreSQL, against the mock Feide, plus a driver
 * that logs a mock user in through the real redirects.
 *
 * Why: AUTH-001 to AUTH-004 are proven end to end: the browser's redirects to Feide and back, the login cookie,
 *      the session cookie. The driver plays the browser with supertest and fetch, so no real browser is needed.
 * Spec: AUTH-001, AUTH-003
 * Tests: shared by apps/server/test/auth/feide/*.int.test.ts
 */
import express, { type Express } from 'express';
import request, { type Response } from 'supertest';
import { startMockFeide, type MockFeide } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { AuthAuditRecorder } from '../../src/auth/audit/AuthAuditRecorder.js';
import { FeideClient } from '../../src/auth/feide/FeideClient.js';
import { feideLoginRoutes } from '../../src/auth/feide/feideLoginRoutes.js';
import type { FeideRolePolicy } from '../../src/auth/feide/FeideRoleMapper.js';
import { LoginTransactions } from '../../src/auth/feide/loginTransactions.js';
import { AccountResolver } from '../../src/auth/identity/AccountResolver.js';
import { portalSessionMiddleware } from '../../src/auth/session/portalSessionMiddleware.js';
import { LOGIN_COOKIE, SESSION_COOKIE } from '../../src/auth/session/sessionCookies.js';
import { SessionStore } from '../../src/auth/session/SessionStore.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { DataEncryption } from '../../src/security/keys/DataEncryption.js';
import { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';
import { capturedLogger } from './capturedLogger.js';
import { serviceEnv } from './services.js';

/** The public base URL the test app pretends to have. */
export const TOOL_URL = 'http://localhost:3000';

/** A running Feide test bed. */
export interface FeideTestbed {
  readonly app: Express;
  readonly feide: MockFeide;
  readonly db: Database;
  readonly redis: Redis;
  readonly sessions: SessionStore;
  /** Every log line the app wrote, as JSON text. */
  readonly logs: string[];
  close(): Promise<void>;
}

/**
 * Starts the mock Feide and the login routes.
 * @param policy - Overrides of the role policy (defaults: hvl.no, admin `author@hvl.no`, the PPU101 course).
 * @returns The test bed.
 */
export async function openFeideTestbed(policy: Partial<FeideRolePolicy> = {}): Promise<FeideTestbed> {
  const env = serviceEnv();
  const feide = await startMockFeide({ host: '127.0.0.1' });
  const db = createPrismaClient(env.DATABASE_URL);
  const redis = await connectRedis(env.REDIS_URL);
  const { logger, lines: logs } = capturedLogger('debug');
  const sessions = new SessionStore({ redis, encryption: new DataEncryption(env.DATA_ENCRYPTION_KEYS) });
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  const audit = new AuthAuditRecorder({ db, hasher, logger });
  const client = new FeideClient({
    issuer: feide.issuer,
    clientId: feide.clientId,
    clientSecret: 'test-only-feide-secret',
    redirectUri: `${TOOL_URL}/auth/feide/callback`,
    postLogoutRedirectUri: `${TOOL_URL}/auth/logged-out`,
  });
  const routes = feideLoginRoutes({
    feide: client,
    transactions: new LoginTransactions(redis),
    sessions,
    audit,
    publicBaseUrl: TOOL_URL,
    logger,
    login: {
      groupsApiUrl: feide.groupsApiUrl,
      policy: {
        allowedOrgs: ['hvl.no'],
        adminFeideIds: ['author@hvl.no'],
        authorCourseGroups: ['fc:fs:fs:emne:hvl.no:ppu101'],
        ...policy,
      },
      accounts: new AccountResolver({ db, hasher }),
      secrets: env.PSEUDONYM_SECRETS,
      audit,
    },
  });
  const app = express().use(portalSessionMiddleware(sessions)).use(routes);
  return {
    app,
    feide,
    db,
    redis,
    sessions,
    logs,
    close: async () => {
      await feide.close();
      await Promise.all([redis.quit(), db.$disconnect()]);
    },
  };
}

/**
 * The `name=value` pair a response set for a cookie.
 * @param res - A supertest response.
 * @param name - The cookie name.
 * @returns The pair, or undefined when the response did not set it (or cleared it).
 */
export function cookiePair(res: Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const pair = (header ?? []).map((c) => c.split(';')[0] ?? '').find((c) => c.startsWith(`${name}=`));
  return pair && pair !== `${name}=` ? pair : undefined;
}

/** What a driven login produced. */
export interface DrivenLogin {
  /** The callback's response (303 on success, an error page otherwise). */
  readonly res: Response;
  /** `__Host-hvli_sid=…`, when a session was started. */
  readonly sessionCookie: string | undefined;
  /** The callback path with `code` and `state`, as Feide sent the browser back. */
  readonly callbackPath: string;
  /** `__Host-hvli_login=…` of this login. */
  readonly loginCookie: string;
}

/**
 * Logs a mock Feide user in, following the redirects like a browser.
 * @param tb - The test bed (or any app with a mock Feide).
 * @param userKey - The mock Feide user, e.g. `author`, `student`.
 * @param returnTo - Where the portal should go after login.
 * @returns The callback response and cookies.
 */
export async function loginWithFeide(
  tb: Pick<FeideTestbed, 'app' | 'feide'>,
  userKey: string,
  returnTo?: string,
): Promise<DrivenLogin> {
  tb.feide.nextLogin(userKey);
  const start = await request(tb.app)
    .get('/auth/feide/login')
    .query(returnTo ? { returnTo } : {});
  if (start.status !== 302) throw new Error(`login start answered ${start.status}`);
  const loginCookie = cookiePair(start, LOGIN_COOKIE) ?? '';
  const authorize = await fetch(String(start.headers.location), { redirect: 'manual' });
  const callback = new URL(authorize.headers.get('location') ?? '');
  const callbackPath = `${callback.pathname}${callback.search}`;
  const res = await request(tb.app).get(callbackPath).set('Cookie', loginCookie);
  return { res, sessionCookie: cookiePair(res, SESSION_COOKIE), callbackPath, loginCookie };
}
