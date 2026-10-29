/**
 * duplicateRouteBench — the duplicate probe's bench (real content types, an owner and a copier) with the `/api`
 * router mounted on the same H5P runtime, so `POST /api/content/:contentId/duplicate` saves through the real editor.
 *
 * Why: the duplicate route must be tested on the real types and the real save path (D-092), as the probe P2 and the
 *      duplicator tests are; the API testbed has no H5P engine. This bench reuses the probe's setup and builds the
 *      studio's services with the server's own `createStudioServices`, with the bench's editor; only authentication
 *      is replaced, as in ../../support/apiTestbed.ts: a request names its principal in a header.
 * Spec: PROD-007
 * Invariants:
 *   - Every principal is a bench actor (its `User` row is the testbed's), so `close()` removes every row, file and
 *     audit event the tests made, and then the studio's services and their Redis client.
 *   - A principal made from an actor is a portal principal with the actor's role and facts; `overrides` change any.
 *   - `placeInCanvas` makes its own platform row, which `close()` deletes with its placements.
 * Collaborators: ./duplicatorBench.ts, ../../../src/http/api/apiRouter.ts, ../../../src/server/studioServices.ts.
 * Tests: apps/server/test/learningDesign/collaboration/duplicateRoute.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import { createClient } from 'redis';
import type { Principal } from '../../../src/auth/Principal.js';
import { setPrincipal } from '../../../src/auth/principalLocals.js';
import type { HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { apiRouter } from '../../../src/http/api/apiRouter.js';
import { h5pErrorHandler } from '../../../src/http/h5pErrorHandler.js';
import { HttpError } from '../../../src/http/HttpError.js';
import type { Redis } from '../../../src/infra/redisClient.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import { createLogger } from '../../../src/logging/logger.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { closeStudioServices, createStudioServices } from '../../../src/server/studioServices.js';
import { serviceEnv } from '../../support/services.js';
import { openDuplicatorBench, type DuplicatorBench } from './duplicatorBench.js';

const PRINCIPAL_HEADER = 'x-test-principal';

/** The bench, its `/api` app and a way to call it as one of its actors. */
export interface DuplicateRouteBench extends DuplicatorBench {
  /** The `/api` router on the bench's runtime and database. */
  readonly api: Express;
  /** The header that makes a request the actor's, as a portal principal with `overrides`. */
  as(actor: HvlH5pActor, overrides?: Partial<Principal>): readonly [string, string];
  /** Places an activity in a Canvas course of a platform made for this bench (removed, with it, by `close()`). */
  placeInCanvas(contentId: string): Promise<void>;
}

/** A platform row for placements only: no launch ever uses it. */
const testPlatform = () => ({
  url: `https://w4-${randomUUID()}.canvas.example`,
  clientId: '1',
  name: 'Canvas',
  authenticationEndpoint: 'https://sso.example/auth',
  accessTokenEndpoint: 'https://sso.example/token',
  idTokenValidationMethod: 'JWK_SET',
  idTokenValidationKey: 'https://sso.example/jwks',
  publicKey: 'p',
  privateKeyEncrypted: Buffer.from([1]),
});

/**
 * Starts the bench (real packages, two authors) and mounts the `/api` router on it.
 * @returns The bench; call `close()` in `afterAll`.
 */
export async function openDuplicateRouteBench(): Promise<DuplicateRouteBench> {
  const bench = await openDuplicatorBench();
  const { db, runtime } = bench.tb;
  const env = serviceEnv();
  const redis = createClient({ url: env.REDIS_URL }) as Redis;
  await redis.connect();
  const access = new PrismaContentAccessRepository(db);
  const publishing = { db, validator: () => [], clock: () => new Date() };
  const logger = createLogger({ level: 'silent' });
  const studio = createStudioServices({
    env,
    logger,
    db,
    redis,
    h5p: { editor: runtime.editor },
    studioContent: loadStudioContent(),
    access,
    hasher: new IdentityHasher(env.IDENTITY_HASH_KEYS),
    publishing,
  });
  const principals = new Map<string, Principal>();
  const api = express();
  api.use((req, res, next) => {
    const principal = principals.get(String(req.headers[PRINCIPAL_HEADER] ?? ''));
    if (principal) setPrincipal(res, principal);
    next();
  });
  api.use('/api', apiRouter({ publishing, access, studio, serveDocs: false }), (_req, _res, next) =>
    next(new HttpError(404, 'error.notFound')),
  );
  api.use('/api', h5pErrorHandler(logger));
  const closeBench = bench.close;
  const platformIds: string[] = [];
  return Object.assign(bench, {
    api,
    placeInCanvas: async (contentId: string) => {
      const { id: platformId } = await db.ltiPlatform.create({ data: testPlatform() });
      platformIds.push(platformId);
      await db.ltiPlacement.create({
        data: { platformId, contextId: 'course-1', resourceLinkId: 'l', contentId },
      });
    },
    as: (actor: HvlH5pActor, overrides: Partial<Principal> = {}) => {
      const name = randomUUID();
      principals.set(name, {
        userId: actor.accountId,
        learnerKey: actor.learnerKey,
        roles: [actor.role],
        mode: 'portal',
        locale: 'nn',
        hvlMember: actor.hvlMember,
        feideAuthenticated: actor.feideAuthenticated,
        studentAuthor: actor.studentAuthor,
        ...overrides,
      } satisfies Principal);
      return [PRINCIPAL_HEADER, name] as const;
    },
    close: async () => {
      // WHY: deleting the platforms removes their placements (cascade) before the activities go.
      await db.ltiPlatform.deleteMany({ where: { id: { in: platformIds } } });
      await closeStudioServices(studio);
      await redis.quit();
      await closeBench();
    },
  });
}
