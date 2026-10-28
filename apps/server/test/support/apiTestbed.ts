/**
 * apiTestbed — the `/api` router on the test PostgreSQL with an injected principal, a replaceable validator and a
 * movable clock, for the API integration tests.
 *
 * Why: the publish flow must be proven blocked, acknowledged, expired (after 14 days) and racing (PROD-003, UD-022)
 *      without waiting two weeks and without the real validator, which another workstream builds (D-073). Only
 *      authentication is replaced: a request names its principal in the `x-test-principal` header; the routes,
 *      permission rules, schemas and error handler are the server's own.
 * Spec: PROD-003, UD-022, DOC-012
 * Invariants:
 *   - Every principal gets its own `User` row; `close` removes them with their activities, acknowledgements,
 *     dismissals and audit rows.
 *   - `validator` and `clockOffsetMs` are read on every request, so a test can change them between requests.
 *   - The studio's routes are mounted with the real services (./apiTestbedStudio.ts) on the test Redis and the
 *     repository's studio content (or the content a test passes); only the H5P engine is a stand-in.
 * Collaborators: ../../src/http/api/apiRouter.ts, ../../src/http/h5pErrorHandler.ts, ./services.ts,
 *   ./apiTestbedStudio.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/http/api/publishGuards.int.test.ts,
 *   apps/server/test/http/api/meRoutes.int.test.ts, apps/server/test/http/api/contentListRoutes.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import type { Principal, Role } from '../../src/auth/Principal.js';
import { setPrincipal } from '../../src/auth/principalLocals.js';
import { PrismaContentAccessRepository } from '../../src/h5p/permissions/ContentAccessRepository.js';
import { apiRouter } from '../../src/http/api/apiRouter.js';
import { h5pErrorHandler } from '../../src/http/h5pErrorHandler.js';
import { HttpError } from '../../src/http/HttpError.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import type { Redis } from '../../src/infra/redisClient.js';
import { loadStudioContent, type StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { createLogger } from '../../src/logging/logger.js';
import { closeStudioServices, type StudioServices } from '../../src/server/studioServices.js';
import type { ContentValidator } from '../../src/validation/types.js';
import { createClient } from 'redis';
import { apiTestbedStudio } from './apiTestbedStudio.js';
import { serviceEnv } from './services.js';

/** The header that makes a request a test principal's. */
export const PRINCIPAL_HEADER = 'x-test-principal';

/** A principal with a `User` row, and the header that makes a request theirs. */
export interface TestPrincipal {
  readonly principal: Principal;
  readonly header: readonly [string, string];
}

/** How a stored test activity looks. */
export interface TestContentOptions {
  readonly title?: string;
  readonly status?: 'draft' | 'published';
  readonly visibility?: 'private' | 'organisation' | 'feide';
  readonly coAuthors?: readonly string[];
}

/** The app, its database and the knobs a test turns. */
export interface ApiTestbed {
  readonly app: Express;
  readonly db: Database;
  /** The test Redis (connected in the background; commands wait for the connection). */
  readonly redis: Redis;
  /** The studio's services the studio routes use. */
  readonly studio: StudioServices;
  /** The validator the findings, publish and save code use; returns no findings until a test replaces it. */
  validator: ContentValidator;
  /** How far the publish flow's clock is ahead of the real one. */
  clockOffsetMs: number;
  /** Creates a `User` row and a principal (portal, Nynorsk, HVL member) with that account. */
  principal(role: Role, overrides?: Partial<Principal>): Promise<TestPrincipal>;
  /** Stores an H5P.MultiChoice 1.16 activity owned by `ownerUserId`, without the H5P engine. */
  content(ownerUserId: string, options?: TestContentOptions): Promise<string>;
  close(): Promise<void>;
}

/**
 * Builds the testbed.
 * @param options - `studioContent`: the studio content instead of the repository's `content/`.
 * @returns The testbed; call `close()` in `afterAll`.
 */
export function openApiTestbed(options: { studioContent?: StudioContent } = {}): ApiTestbed {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  // WHY: the testbed is built synchronously at collection time; the client queues commands until it is connected.
  const redis = createClient({ url: serviceEnv().REDIS_URL }) as Redis;
  redis.on('error', () => undefined);
  const connecting = redis.connect();
  const principals = new Map<string, Principal>();
  const userIds: string[] = [];
  const app = express();
  // WHY: read on every request, so a test can replace the validator or move the clock between requests.
  const publishing = {
    db,
    validator: ((input) => tb.validator(input)) satisfies ContentValidator,
    clock: () => new Date(Date.now() + tb.clockOffsetMs),
  };
  const access = new PrismaContentAccessRepository(db);
  const studioContent = options.studioContent ?? loadStudioContent();
  const studio = apiTestbedStudio({ db, redis, access, publishing, studioContent });
  const tb: ApiTestbed = {
    app,
    db,
    redis,
    studio,
    validator: () => [],
    clockOffsetMs: 0,
    principal: async (role, overrides = {}) => {
      const kind = role === 'learner' ? 'learner' : 'staff';
      const { id } = await db.user.create({ data: { kind }, select: { id: true } });
      userIds.push(id);
      const principal: Principal = {
        userId: id,
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
      return { principal, header: [PRINCIPAL_HEADER, name] as const };
    },
    content: async (ownerUserId, options = {}) => {
      const { title = 'Quiz', status = 'draft', visibility = 'private' } = options;
      const params = { question: 'Kva?' };
      const metadata = {
        title,
        mainLibrary: 'H5P.MultiChoice',
        preloadedDependencies: [{ machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16 }],
      };
      const { id } = await db.h5PContent.create({
        data: { mainLibrary: 'H5P.MultiChoice', title, params, metadata, status, visibility, ownerUserId },
        select: { id: true },
      });
      for (const userId of options.coAuthors ?? []) {
        await db.contentCollaborator.create({ data: { contentId: id, userId } });
      }
      return id;
    },
    close: async () => {
      await db.h5PContent.deleteMany({ where: { ownerUserId: { in: userIds } } });
      await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await closeStudioServices(studio);
      await connecting;
      await Promise.all([redis.quit(), db.$disconnect()]);
    },
  };
  app.use((req, res, next) => {
    const principal = principals.get(String(req.headers[PRINCIPAL_HEADER] ?? ''));
    if (principal) setPrincipal(res, principal);
    next();
  });
  app.use('/api', apiRouter({ publishing, access, studio, serveDocs: true }), (_req, _res, next) =>
    next(new HttpError(404, 'error.notFound')),
  );
  app.use('/api', h5pErrorHandler(createLogger({ level: 'silent' })));
  return tb;
}
