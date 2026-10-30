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
 *   - `close` removes the platform (its deployments, identities, tokens and placements cascade), the users of its
 *     mock Canvas and of `staffAccount`, its own mock Feide's users that first signed in during its run (by subject),
 *     their content and audit rows, every activity `activity` saved (whoever owns it) and the S3 buckets. It never
 *     touches LTI, staff or run-author accounts of another testbed; the demo Feide subjects are the same in every
 *     process, so suites that sign in with them run one at a time (the e2e and a11y configs run files in turn).
 *   - With `runAuthor`, the mock Feide's `author` is new in this run (./runFeideAuthor.ts), so `close` removes it.
 *   - Every log line is kept in `logs` so tests can prove that no token or personal value was logged.
 *   - The studio content is the repository's `content/`, loaded as main.ts loads it, unless a test passes its own
 *     (e.g. ./renamedPhaseLabels.ts); `close` closes the studio's services as main.ts's shutdown does.
 * Collaborators: ../../src/server/createApp.ts, ../../src/server/studioServices.ts,
 *   ../../../../tools/mock-platform/mockPlatform.mjs, ./services.ts, ./runFeideAuthor.ts, ./issuerScopedPlatforms.ts.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts and the other users of `openAppTestbed`.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CreateBucketCommand } from '@aws-sdk/client-s3';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import { startMockPlatform, type MockPlatform } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { loadEnv, type Env } from '../../src/config/env.js';
import { loadValidationContext } from '../../src/config/validationContext.js';
import { createH5pRuntime, type H5pRuntime } from '../../src/h5p/createH5pRuntime.js';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { createS3Client } from '../../src/infra/s3Client.js';
import { loadStudioContent, type StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { syncLtiPlatforms } from '../../src/lti/platforms/syncLtiPlatforms.js';
import { createApp, type App } from '../../src/server/createApp.js';
import { closeStudioServices } from '../../src/server/studioServices.js';
import { createContentValidator } from '../../src/validation/validateContent.js';
import type { WebApp } from '../../src/web/nextWebApp.js';
import { capturedLogger } from './capturedLogger.js';
import { scopedTo } from './issuerScopedPlatforms.js';
import { uniqueName } from './services.js';
import { accountOfFeideUser, feideSubjectHashes, giveRunAuthor } from './runFeideAuthor.js';
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
  /** The `User.id` a mock Feide user (by key, e.g. `author`) signed in to; throws when they have not signed in. */
  feideAccount(key: string): Promise<string>;
  /** Saves an H5P.MultiChoice activity owned by `ownerUserId`; `published` also shares it with all of HVL. */
  activity(ownerUserId: string, options?: { published?: boolean; title?: string }): Promise<string>;
  close(): Promise<void>;
}

/**
 * Starts the app, the mock Canvas and the mock Feide.
 * @param libraries - The installed H5P libraries (default: the HTTP test set).
 * @param options - `web`: a web app (a stub, or the built one from `loadWebApp`) mounted as main.ts mounts it;
 *   `runAuthor`: the mock Feide's `author` gets a Feide ID of this run (./runFeideAuthor.ts); `studioContent`: the
 *   studio content instead of the repository's `content/`.
 * @returns The testbed.
 */
export async function openAppTestbed(
  libraries: SyntheticLibrary[] = HTTP_TEST_LIBRARIES,
  options: { web?: Pick<WebApp, 'dev' | 'handle'>; runAuthor?: boolean; studioContent?: StudioContent } = {},
): Promise<AppTestbed> {
  const startedAt = new Date();
  let handler = (_req: IncomingMessage, res: ServerResponse): void => void res.writeHead(503).end();
  const server: Server = createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const toolUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  const mock = await startMockPlatform({ toolUrl });
  if (options.runAuthor) giveRunAuthor(mock.feide);
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
  const { logger, lines: logs } = capturedLogger('debug');
  const runtime = await createH5pRuntime({ env, logger, db, redis, s3 });
  // WHY: the whole app as main.ts builds it, including the real pre-publish validator (D-073).
  const validator = createContentValidator(loadValidationContext(env));
  const built = createApp({
    env,
    logger,
    db,
    redis,
    h5p: runtime,
    validator,
    studioContent: options.studioContent ?? loadStudioContent(),
    ...(options.web ? { web: options.web } : {}),
  });
  const platforms = scopedTo(built.lti.provider.platformManager, mock.canvas.issuer);
  await syncLtiPlatforms(env.LTI_PLATFORMS, { platforms, db });
  const platform = await platforms.getPlatformByUrlAndClientId(mock.canvas.issuer, mock.canvas.clientId);
  if (!platform) throw new Error('the mock Canvas was not registered');
  handler = built.app;

  const madeHere = new Set<string>();
  const savedHere = new Set<string>();
  /** The users this testbed made: its staff accounts, its mock Canvas's users and its mock Feide's users new now. */
  const ownUsers = async (): Promise<string[]> => {
    const feide = { provider: 'feide', createdAt: { gte: startedAt } } as const;
    const subjectHash = { in: feideSubjectHashes(env, mock.feide) };
    const identities = await db.identity.findMany({
      where: { OR: [{ platformId: platform.id }, { ...feide, subjectHash }] },
      select: { userId: true },
    });
    return [...new Set([...madeHere, ...identities.map((identity) => identity.userId)])];
  };
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
    feideAccount: (key) => accountOfFeideUser(db, env, mock.feide, key),
    staffAccount: async () => {
      const { id } = await db.user.create({ data: { kind: 'staff' } });
      madeHere.add(id);
      return id;
    },
    activity: async (ownerUserId, options = {}) => {
      const actor = testActor('author', { accountId: ownerUserId });
      const id = await runtime.editor.saveOrUpdateContent(
        undefined,
        { question: 'Kva?', answers: ['Ja'] },
        { title: options.title ?? 'Quiz', license: 'U' } as unknown as IContentMetadata,
        'H5P.MultiChoice 1.16',
        asAccountUser(actor),
      );
      savedHere.add(id);
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
      // WHY: before the platform goes, because its identities (which name its users) cascade with it.
      const users = await ownUsers();
      await db.ltiPlatform.deleteMany({ where: { url: mock.canvas.issuer } });
      await db.h5PContent.deleteMany({
        where: { OR: [{ ownerUserId: { in: users } }, { id: { in: [...savedHere] } }] },
      });
      await db.auditEvent.deleteMany({ where: { actorUserId: { in: users } } });
      await db.authAuditEvent.deleteMany({ where: { actorUserId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      for (const bucket of Object.values(buckets)) await removeTestBucket(s3, bucket);
      await closeStudioServices(built.studio);
      await Promise.all([redis.quit(), db.$disconnect()]);
    },
  };
}
