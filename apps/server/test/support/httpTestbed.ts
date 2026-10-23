/**
 * httpTestbed — the production H5P runtime and router on the test PostgreSQL, Redis and S3, behind Express.
 *
 * Why: the HTTP tests must exercise what the server will run: createH5pRuntime (factories, permission system,
 *      sanitisers, guard) and createH5pRouter. Only authentication is replaced (S3 brings the real one): a
 *      request names its actor in the `x-test-actor` header, and requests without it have no actor at all.
 * Spec: H5P-004, H5P-006
 * Tests: shared by apps/server/test/http/*.int.test.ts.
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreateBucketCommand, type S3Client } from '@aws-sdk/client-s3';
import express, { type Express, type RequestHandler } from 'express';
import { createH5pRuntime, type H5pRuntime } from '../../src/h5p/createH5pRuntime.js';
import type { H5pRole, HvlH5pActor } from '../../src/h5p/HvlH5pUser.js';
import { createH5pRouter } from '../../src/http/createH5pRouter.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { createS3Client } from '../../src/infra/s3Client.js';
import { createLogger } from '../../src/logging/logger.js';
import { newLearner } from './learnerStateFixtures.js';
import { serviceEnv, uniqueName } from './services.js';
import { removeTestBucket } from './storageFixtures.js';
import { syntheticLibraryDir, type SyntheticLibrary } from './syntheticLibraries.js';
import { HTTP_TEST_LIBRARIES } from './tenTypeLibraries.js';

/** A registered person and the header that makes a request theirs. */
export interface TestActor {
  readonly actor: HvlH5pActor;
  readonly header: readonly [string, string];
}

/** The app, the runtime and helpers. */
export interface HttpTestbed {
  readonly app: Express;
  readonly runtime: H5pRuntime;
  readonly db: Database;
  /** Creates a `User` row and an actor with that account; overrides change any other field. */
  actor(role: H5pRole, overrides?: Partial<HvlH5pActor>): Promise<TestActor>;
  /** Deletes everything the testbed created and disconnects. */
  close(): Promise<void>;
}

const ACTOR_HEADER = 'x-test-actor';

/**
 * Builds the testbed.
 * @param libraries - Libraries to install (the ten stand-ins, TrueFalse and DragQuestion by default).
 * @returns The testbed; call `close()` in `afterAll`.
 */
export async function openHttpTestbed(
  libraries: SyntheticLibrary[] = HTTP_TEST_LIBRARIES,
): Promise<HttpTestbed> {
  const libraryDir = syntheticLibraryDir(libraries);
  const buckets = { content: uniqueName('content'), temporary: uniqueName('temporary') };
  const env = {
    ...serviceEnv(),
    H5P_LIBRARY_DIR: libraryDir,
    S3_CONTENT_BUCKET: buckets.content,
    S3_TEMPORARY_BUCKET: buckets.temporary,
  };
  const s3: S3Client = createS3Client(env);
  for (const Bucket of Object.values(buckets)) await s3.send(new CreateBucketCommand({ Bucket }));
  const db = createPrismaClient(env.DATABASE_URL);
  const redis: Redis = await connectRedis(env.REDIS_URL);
  const logger = createLogger({ level: 'silent' });
  const runtime = await createH5pRuntime({ env, logger, db, redis, s3 });
  const actors = new Map<string, HvlH5pActor>();
  const authenticate: RequestHandler = (req, res, next) => {
    const actor = actors.get(String(req.headers[ACTOR_HEADER] ?? ''));
    if (actor) res.locals.h5pActor = actor;
    next();
  };
  const app = express();
  app.use('/h5p', createH5pRouter(runtime, authenticate));
  const userIds: string[] = [];
  return {
    app,
    runtime,
    db,
    actor: async (role, overrides = {}) => {
      const kind = role === 'learner' ? 'learner' : 'staff';
      const { id } = await db.user.create({ data: { kind }, select: { id: true } });
      userIds.push(id);
      const actor: HvlH5pActor = {
        ...{ accountId: id, role, learnerKey: newLearner(), contextId: '', locale: 'nn' as const },
        ...{ hvlMember: true, feideAuthenticated: true, ltiLaunchContentIds: [] },
        ...overrides,
      };
      const name = randomUUID();
      actors.set(name, actor);
      return { actor, header: [ACTOR_HEADER, name] as const };
    },
    close: async () => {
      await db.h5PContent.deleteMany({ where: { ownerUserId: { in: userIds } } });
      await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
      await db.libraryAuditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      for (const bucket of Object.values(buckets)) await removeTestBucket(s3, bucket);
      await Promise.all([redis.quit(), db.$disconnect()]);
      s3.destroy();
      rmSync(libraryDir, { recursive: true, force: true });
    },
  };
}

/** A fresh temporary folder for files a test uploads. */
export const uploadDir = (): string => mkdtempSync(join(tmpdir(), 'h5p-upload-src-'));
