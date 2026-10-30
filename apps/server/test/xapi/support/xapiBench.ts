/**
 * xapiBench — `POST /api/h5p/xapi` on the test PostgreSQL and Redis, with an injected principal, a movable clock, a
 * recording listener and activities of any main library, for the ingestion's integration tests.
 *
 * Why: the storing rules, limits and listener need many principals (portal and LTI, learner and author) and
 *      activities of the ten types, which the full app would make slow to set up. Only authentication is replaced, as
 *      in ../../support/apiTestbed.ts: the route, the ingestion, the store, the rate limit and the error handler are
 *      the server's own; the full app's authentication is tested in ../xapiRouteAuth.int.test.ts.
 * Spec: LTI-011, DATA-012
 * Invariants:
 *   - Every principal and activity owner gets its own `User` row; `close` removes the activities (their statements
 *     cascade), the users and the rate-limit counters of those users.
 *   - The listener records the rows, principal and request facts it gets, and how many of the rows the database
 *     already holds when it runs. An LTI principal's request carries the `sub` `sub-of-<userId>`.
 * Collaborators: ../../../src/xapi/xapiRoutes.ts, ../../../src/xapi/XapiIngest.ts, ../../support/services.ts,
 *   ../../support/capturedLogger.ts.
 * Tests: apps/server/test/xapi/xapiIngest.int.test.ts, apps/server/test/xapi/xapiLimits.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import type { Principal, Role } from '../../../src/auth/Principal.js';
import { setLtiSubject, setPrincipal } from '../../../src/auth/principalLocals.js';
import type { XapiStatement } from '../../../src/generated/prisma/client.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { h5pErrorHandler } from '../../../src/http/h5pErrorHandler.js';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { XapiIngest, type XapiRequestFacts } from '../../../src/xapi/XapiIngest.js';
import { XAPI_RATE_KEY_PREFIX, XapiRateLimit } from '../../../src/xapi/XapiRateLimit.js';
import { xapiRoutes } from '../../../src/xapi/xapiRoutes.js';
import { XapiStatementStore } from '../../../src/xapi/XapiStatementStore.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { serviceEnv } from '../../support/services.js';

/** The header that makes a request a test principal's. */
export const BENCH_PRINCIPAL_HEADER = 'x-test-principal';

/** One call of the listener. */
export interface ListenerCall {
  readonly rows: XapiStatement[];
  readonly principal: Principal;
  readonly request: XapiRequestFacts;
  /** How many of the rows the database held when the listener ran (after commit: all of them). */
  readonly committed: number;
}

/** The bench. */
export interface XapiBench {
  readonly app: Express;
  readonly db: Database;
  readonly redis: Redis;
  readonly logs: string[];
  readonly calls: ListenerCall[];
  /** Make the listener throw. */
  listenerFails: boolean;
  /** The ingestion's clock: a fixed moment, or the real clock when undefined (the default). */
  now: Date | undefined;
  /** A principal with a `User` row, and the header that makes a request theirs. */
  principal(
    role: Role,
    overrides?: Partial<Principal>,
  ): Promise<{ principal: Principal; header: [string, string] }>;
  /** A published, organisation-wide activity of this main library (e.g. `H5P.QuestionSet 1.21`). */
  activity(ubername: string, options?: { version?: number; status?: 'draft' | 'published' }): Promise<string>;
  /** The stored statements of an activity, oldest first. */
  rowsOf(contentId: string): Promise<XapiStatement[]>;
  close(): Promise<void>;
}

/**
 * Opens the bench.
 * @returns The bench; call `close()` in `afterAll`.
 */
export async function openXapiBench(): Promise<XapiBench> {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const redis = await connectRedis(env.REDIS_URL);
  const { logger, lines: logs } = capturedLogger('debug');
  const principals = new Map<string, Principal>();
  const userIds: string[] = [];
  const contentIds: string[] = [];
  const newUser = async (kind: 'staff' | 'learner') => {
    const { id } = await db.user.create({ data: { kind }, select: { id: true } });
    userIds.push(id);
    return id;
  };
  const bench: XapiBench = {
    app: express(),
    db,
    redis,
    logs,
    calls: [],
    listenerFails: false,
    now: undefined,
    principal: async (role, overrides = {}) => {
      const principal: Principal = {
        userId: await newUser(role === 'learner' ? 'learner' : 'staff'),
        learnerKey: `learner-${randomUUID()}`,
        roles: [role],
        mode: 'portal',
        locale: 'nn',
        hvlMember: true,
        feideAuthenticated: true,
        studentAuthor: false,
        ...overrides,
      };
      const name = randomUUID();
      principals.set(name, principal);
      return { principal, header: [BENCH_PRINCIPAL_HEADER, name] };
    },
    activity: async (ubername, options = {}) => {
      const [machineName = '', version = ''] = ubername.split(' ');
      const [major, minor] = version.split('.').map(Number);
      const metadata = {
        title: 'Test',
        mainLibrary: machineName,
        preloadedDependencies: [{ machineName, majorVersion: major, minorVersion: minor }],
      };
      const { id } = await db.h5PContent.create({
        data: {
          mainLibrary: machineName,
          title: 'Test',
          params: {},
          metadata,
          status: options.status ?? 'published',
          visibility: 'organisation',
          version: options.version ?? 1,
          ownerUserId: await newUser('staff'),
        },
        select: { id: true },
      });
      contentIds.push(id);
      return id;
    },
    rowsOf: (contentId) => db.xapiStatement.findMany({ where: { contentId }, orderBy: { timestamp: 'asc' } }),
    close: async () => {
      await db.h5PContent.deleteMany({ where: { id: { in: contentIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      const counters = await redis.keys(`${XAPI_RATE_KEY_PREFIX}*`);
      const own = counters.filter((key) =>
        userIds.some((id) => key.startsWith(`${XAPI_RATE_KEY_PREFIX}${id}:`)),
      );
      if (own.length > 0) await redis.del(own);
      await Promise.all([redis.quit(), db.$disconnect()]);
    },
  };
  const ingest = new XapiIngest({
    access: new PrismaContentAccessRepository(db),
    db,
    statements: new XapiStatementStore(db),
    rateLimit: new XapiRateLimit(redis),
    clock: () => bench.now ?? new Date(),
    logger,
    onStored: async (rows, principal, request) => {
      const committed = await db.xapiStatement.count({ where: { id: { in: rows.map((row) => row.id) } } });
      bench.calls.push({ rows, principal, request, committed });
      if (bench.listenerFails) throw new Error(`listener failed for ${principal.learnerKey}`);
    },
  });
  bench.app.use((req, res, next) => {
    const principal = principals.get(String(req.headers[BENCH_PRINCIPAL_HEADER] ?? ''));
    if (principal) setPrincipal(res, principal);
    // WHY: as requestPrincipal does for an ltik: the launch's `sub` beside the principal (D-104).
    if (principal?.lti) setLtiSubject(res, `sub-of-${principal.userId}`);
    next();
  });
  bench.app.use('/api', xapiRoutes({ ingest }));
  bench.app.use('/api', h5pErrorHandler(logger));
  return bench;
}
