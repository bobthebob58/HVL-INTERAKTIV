/**
 * main — starts the server: reads the configuration and the studio content, connects PostgreSQL, Redis and S3, builds
 * the H5P engine and the app, registers the configured LTI platforms, starts the cleanup jobs and the grade worker,
 * and listens on `PORT`.
 *
 * Why: one entry point for `npm start`, the e2e tests and production. ltijs never listens itself (D-050), and the
 *      platforms in `LTI_PLATFORMS` are synchronised before the first launch can arrive (D-051).
 * Spec: NFR-002, LTI-001, LTI-002, H5P-001, PED-001, LTI-012
 * Invariants:
 *   - Invalid configuration stops the start with the list of problems and exit code 1; secrets are never printed.
 *     That includes the validator's hint thresholds (content/laeringsdesign/hint-thresholds.yaml), read before any
 *     connection is made (D-073), and the studio content in `content/` (D-082), read next: a bad file stops the start
 *     with every problem named, by file, line and key.
 *   - The server listens only after the platform sync and the platform-key re-encryption (D-056) have finished.
 *   - The grade worker (D-104) and the cleanup of its jobs' LTI subjects (DATA-002) start with the cleanup jobs and
 *     stop with them; each runs on one node per interval.
 *   - A port that cannot be opened stops the start with exit code 1 instead of a process that serves nothing.
 *   - SIGTERM and SIGINT stop the jobs, stop accepting connections, close the studio's services (the PDF export's
 *     browser, D-096), then the clients, even when a service fails to close; exit code 0, or 1 after such a failure.
 *   - The web app is loaded only when `WEB_APP` is not `off`; only its development server takes WebSocket upgrades,
 *     only under `/_next/`, and without cookies, tokens or the ltik, like every request it gets (D-068).
 * Collaborators: ./createApp.ts, ./studioServices.ts, ../h5p/createH5pRuntime.ts,
 *   ../lti/platforms/syncLtiPlatforms.ts, ../lti/platforms/reencryptPlatformKeys.ts,
 *   ../lti/storage/LtiRecordCleanupJob.ts, ../grades/GradeSyncWorker.ts, ../grades/GradeSubjectCleanupJob.ts,
 *   ../config/env.ts, ../config/validationContext.ts,
 *   ../validation/validateContent.ts, ../learningDesign/content/loadStudioContent.ts, ../web/nextWebApp.ts,
 *   ../web/webRoutes.ts (`webUpgrades`).
 * Tests: apps/server/test/server/main.smoke.test.ts, apps/server/test/server/startupContent.test.ts
 */
import type { Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { InvalidEnvironmentError, loadEnv, type Env } from '../config/env.js';
import { InvalidValidationContextError, loadValidationContext } from '../config/validationContext.js';
import { GradeSubjectCleanupJob } from '../grades/GradeSubjectCleanupJob.js';
import { GradeSyncWorker } from '../grades/GradeSyncWorker.js';
import { createH5pRuntime } from '../h5p/createH5pRuntime.js';
import { createPrismaClient } from '../infra/prismaClient.js';
import { connectRedis } from '../infra/redisClient.js';
import { createS3Client } from '../infra/s3Client.js';
import { loadStudioContent } from '../learningDesign/content/loadStudioContent.js';
import { StudioContentError } from '../learningDesign/content/StudioContentError.js';
import { reencryptPlatformKeys } from '../lti/platforms/reencryptPlatformKeys.js';
import { syncLtiPlatforms } from '../lti/platforms/syncLtiPlatforms.js';
import { LtiRecordCleanupJob } from '../lti/storage/LtiRecordCleanupJob.js';
import { createLogger } from '../logging/logger.js';
import { DataEncryption } from '../security/keys/DataEncryption.js';
import { createContentValidator } from '../validation/validateContent.js';
import { loadWebApp } from '../web/nextWebApp.js';
import { webUpgrades } from '../web/webRoutes.js';
import { createApp } from './createApp.js';
import { closeStudioServices } from './studioServices.js';

/** A started server and how to stop it. */
export interface RunningServer {
  readonly server: Server;
  /** Stops jobs, connections and clients. */
  stop(): Promise<void>;
}

/** How `startServer` reads its files; every field has the production default. */
export interface StartOptions {
  /** The studio content folder; defaults to the repository's `content/`. Tests pass a fixture folder. */
  readonly studioContentRoot?: string;
}

/**
 * Starts the server.
 * @param env - The parsed configuration.
 * @param options - Where the studio content is read from.
 * @returns The listening server and its stop function.
 * @throws InvalidValidationContextError or StudioContentError, before any connection is made, for a bad content file.
 */
export async function startServer(env: Env, options: StartOptions = {}): Promise<RunningServer> {
  const validator = createContentValidator(loadValidationContext(env));
  const studioContent = loadStudioContent(options.studioContentRoot);
  const logger = createLogger({ level: env.LOG_LEVEL });
  const db = createPrismaClient(env.DATABASE_URL);
  const redis = await connectRedis(env.REDIS_URL, logger);
  const h5p = await createH5pRuntime({ env, logger, db, redis, s3: createS3Client(env) });
  const web = env.WEB_APP === 'off' ? undefined : await loadWebApp(env.WEB_APP);
  const built = { env, logger, db, redis, h5p, validator, studioContent, ...(web ? { web } : {}) };
  const { app, lti, studio } = createApp(built);
  const synced = await syncLtiPlatforms(env.LTI_PLATFORMS, { platforms: lti.provider.platformManager, db });
  logger.info(synced, 'LTI platforms synchronised');
  const encryption = new DataEncryption(env.DATA_ENCRYPTION_KEYS);
  const rewritten = await reencryptPlatformKeys(db, encryption);
  // WHY: not `reencrypted`: keys ending in "encrypted" are redacted, which would hide the count (DATA-009).
  logger.info({ platformKeysRewritten: rewritten }, 'LTI platform keys on the current encryption key');
  const jobs = [
    h5p.cleanupJob,
    new LtiRecordCleanupJob({ db, redis, logger }),
    new GradeSyncWorker({ db, redis, logger, encryption, platforms: lti.provider.platformManager }),
    new GradeSubjectCleanupJob({ db, redis, logger }),
  ];
  for (const job of jobs) job.start();
  // WHY: Express 5 passes a listen failure (port taken, no permission) to this callback; it must fail the start.
  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(env.PORT, (error?: Error) => (error ? reject(error) : resolve(listening)));
  });
  if (web?.dev) server.on('upgrade', webUpgrades(web));
  logger.info({ port: env.PORT, webApp: env.WEB_APP }, 'HVL Interaktiv server listening');
  return {
    server,
    stop: async () => {
      for (const job of jobs) job.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      // WHY: a studio service may still use a client while it closes, so the clients close after it, even if it fails.
      try {
        await closeStudioServices(studio);
      } finally {
        await Promise.all([redis.quit(), db.$disconnect(), web?.close()]);
      }
      logger.info('HVL Interaktiv server stopped');
    },
  };
}

async function main(): Promise<void> {
  let running: RunningServer;
  try {
    running = await startServer(loadEnv());
  } catch (error) {
    // SECURITY: the problem list names variables and rules only, never their values.
    // WHY: a bad thresholds or studio content file is configuration, reported like the environment: the problems
    // (file, line and key), no stack trace. Content files hold no personal data (DATA-009).
    if (
      error instanceof InvalidEnvironmentError ||
      error instanceof InvalidValidationContextError ||
      error instanceof StudioContentError
    ) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    // WHY: idle keep-alive connections would hold `server.close` open until they time out.
    running.server.closeIdleConnections();
    void running.stop().then(
      () => (process.exitCode = 0),
      () => (process.exitCode = 1),
    );
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

// WHY: tests import `startServer` without starting a second server.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
