/**
 * appTestbed — the whole server app (`createApp`) on a real port, with the mock Canvas and mock Feide pointed at it,
 * for integration and end-to-end tests of LTI launches, Deep Linking, Feide login and sharing.
 *
 * Why: the S3 gate asks for mock-OIDC and mock-LTI integration tests through the real routes (spec 02). The mock
 *      Canvas fetches the tool's `/lti/keys` to verify Deep Linking responses, and browsers need a URL, so the app
 *      listens on a port; the mocks need that URL first, so the server starts with a placeholder handler.
 * Spec: LTI-001, LTI-005, AUTH-001, NFR-004
 * Invariants:
 *   - The platform sync sees only this testbed's mock Canvas, so it never deactivates another test's platform.
 *   - `close` removes the platform (its deployments, identities, tokens and placements cascade), every user created
 *     since the testbed opened, their content and audit rows, and the S3 buckets.
 *   - Every log line is kept in `logs` so tests can prove that no token or personal value was logged.
 * Collaborators: ../../src/server/createApp.ts, ../../../../tools/mock-platform/mockPlatform.mjs, ./services.ts.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts and the other users of `openAppTestbed`.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import { CreateBucketCommand } from '@aws-sdk/client-s3';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import type { Provider } from 'ltijs';
import { startMockPlatform, type MockPlatform } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createH5pRuntime, type H5pRuntime } from '../../src/h5p/createH5pRuntime.js';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { createS3Client } from '../../src/infra/s3Client.js';
import { syncLtiPlatforms } from '../../src/lti/platforms/syncLtiPlatforms.js';
import { createLogger } from '../../src/logging/logger.js';
import { createApp, type App } from '../../src/server/createApp.js';
import { uniqueName } from './services.js';
import { removeTestBucket } from './storageFixtures.js';
import { syntheticLibraryDir, type SyntheticLibrary } from './syntheticLibraries.js';
import { HTTP_TEST_LIBRARIES } from './tenTypeLibraries.js';
import { testActor } from './testActors.js';

/** A running app with its mocks. */
export interface AppTestbed extends App {
  /** `http://localhost:<port>`. */
  readonly toolUrl: string;
  readonly env: Env;
  readonly mock: MockPlatform;
  readonly db: Database;
  readonly redis: Redis;
  readonly runtime: H5pRuntime;
  /** Every log line, as JSON text. */
  readonly logs: string[];
  /** The mock Canvas's `LtiPlatform.id`. */
  readonly platformId: string;
  /** Creates a staff account with no identity (for content that belongs to someone else). */
  staffAccount(): Promise<string>;
  /** Saves an H5P.MultiChoice activity owned by `ownerUserId`; `published` also shares it with all of HVL. */
  activity(ownerUserId: string, options?: { published?: boolean; title?: string }): Promise<string>;
  close(): Promise<void>;
}

type PlatformManager = Provider['platformManager'];

/** The platform manager as the sync sees it: only the platforms of one issuer. */
const scopedTo = (manager: PlatformManager, issuer: string): PlatformManager =>
  new Proxy(manager, {
    get(target, property, receiver) {
      if (property === 'getPlatforms') {
        return async () => target.getPlatforms({ url: issuer });
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

/**
 * Starts the app, the mock Canvas and the mock Feide.
 * @param libraries - The installed H5P libraries (default: the HTTP test set).
 * @returns The testbed.
 */
export async function openAppTestbed(
  libraries: SyntheticLibrary[] = HTTP_TEST_LIBRARIES,
): Promise<AppTestbed> {
  const startedAt = new Date();
  let handler = (_req: IncomingMessage, res: ServerResponse): void => void res.writeHead(503).end();
  const server: Server = createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const toolUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  const mock = await startMockPlatform({ toolUrl });
  const buckets = { content: uniqueName('content'), temporary: uniqueName('temporary') };
  const env = loadEnv({
    ...process.env,
    ...mock.env,
    PUBLIC_BASE_URL: toolUrl,
    H5P_LIBRARY_DIR: syntheticLibraryDir(libraries),
    S3_CONTENT_BUCKET: buckets.content,
    S3_TEMPORARY_BUCKET: buckets.temporary,
  });
  const s3 = createS3Client(env);
  for (const Bucket of Object.values(buckets)) await s3.send(new CreateBucketCommand({ Bucket }));
  const db = createPrismaClient(env.DATABASE_URL);
  const redis = await connectRedis(env.REDIS_URL);
  const logs: string[] = [];
  const logger = createLogger({
    level: 'debug',
    destination: new Writable({ write: (chunk, _e, done) => (logs.push(String(chunk)), done()) }),
  });
  const runtime = await createH5pRuntime({ env, logger, db, redis, s3 });
  const built = createApp({ env, logger, db, redis, h5p: runtime });
  const platforms = scopedTo(built.lti.provider.platformManager, mock.canvas.issuer);
  await syncLtiPlatforms(env.LTI_PLATFORMS, { platforms, db });
  const platform = await platforms.getPlatformByUrlAndClientId(mock.canvas.issuer, mock.canvas.clientId);
  if (!platform) throw new Error('the mock Canvas was not registered');
  handler = built.app;

  const createdUsers = async () =>
    (await db.user.findMany({ where: { createdAt: { gte: startedAt } }, select: { id: true } })).map(
      (u) => u.id,
    );
  return {
    ...built,
    toolUrl,
    env,
    mock,
    db,
    redis,
    runtime,
    logs,
    platformId: platform.id,
    staffAccount: async () => (await db.user.create({ data: { kind: 'staff' } })).id,
    activity: async (ownerUserId, options = {}) => {
      const actor = testActor('author', { accountId: ownerUserId });
      const id = await runtime.editor.saveOrUpdateContent(
        undefined,
        { question: 'Kva?', answers: ['Ja'] },
        { title: options.title ?? 'Quiz', license: 'U' } as unknown as IContentMetadata,
        'H5P.MultiChoice 1.16',
        asAccountUser(actor),
      );
      if (options.published) {
        await db.h5PContent.update({
          where: { id },
          data: { status: 'published', visibility: 'organisation' },
        });
      }
      return id;
    },
    close: async () => {
      await mock.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.ltiPlatform.deleteMany({ where: { url: mock.canvas.issuer } });
      const users = await createdUsers();
      await db.h5PContent.deleteMany({ where: { ownerUserId: { in: users } } });
      await db.auditEvent.deleteMany({ where: { actorUserId: { in: users } } });
      await db.authAuditEvent.deleteMany({ where: { at: { gte: startedAt } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      for (const bucket of Object.values(buckets)) await removeTestBucket(s3, bucket);
      await Promise.all([redis.quit(), db.$disconnect()]);
    },
  };
}
