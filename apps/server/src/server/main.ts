/**
 * main — starts the server: reads the configuration, connects PostgreSQL, Redis and S3, builds the H5P engine and
 * the app, registers the configured LTI platforms, starts the cleanup jobs and listens on `PORT`.
 *
 * Why: one entry point for `npm start`, the e2e tests and production. ltijs never listens itself (D-050), and the
 *      platforms in `LTI_PLATFORMS` are synchronised before the first launch can arrive (D-051).
 * Spec: NFR-002, LTI-001, LTI-002, H5P-001
 * Invariants:
 *   - Invalid configuration stops the start with the list of problems and exit code 1; secrets are never printed.
 *   - The server listens only after the platform sync and the platform-key re-encryption (D-056) have finished.
 *   - SIGTERM and SIGINT stop the jobs, stop accepting connections, then close the clients; exit code 0.
 * Collaborators: ./createApp.ts, ../h5p/createH5pRuntime.ts, ../lti/platforms/syncLtiPlatforms.ts,
 *   ../lti/platforms/reencryptPlatformKeys.ts,
 *   ../lti/storage/LtiRecordCleanupJob.ts, ../config/env.ts.
 * Tests: apps/server/test/server/main.smoke.test.ts
 */
import type { Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { InvalidEnvironmentError, loadEnv, type Env } from '../config/env.js';
import { createH5pRuntime } from '../h5p/createH5pRuntime.js';
import { createPrismaClient } from '../infra/prismaClient.js';
import { connectRedis } from '../infra/redisClient.js';
import { createS3Client } from '../infra/s3Client.js';
import { reencryptPlatformKeys } from '../lti/platforms/reencryptPlatformKeys.js';
import { syncLtiPlatforms } from '../lti/platforms/syncLtiPlatforms.js';
import { LtiRecordCleanupJob } from '../lti/storage/LtiRecordCleanupJob.js';
import { createLogger } from '../logging/logger.js';
import { DataEncryption } from '../security/keys/DataEncryption.js';
import { createApp } from './createApp.js';

/** A started server and how to stop it. */
export interface RunningServer {
  readonly server: Server;
  /** Stops jobs, connections and clients. */
  stop(): Promise<void>;
}

/**
 * Starts the server.
 * @param env - The parsed configuration.
 * @returns The listening server and its stop function.
 */
export async function startServer(env: Env): Promise<RunningServer> {
  const logger = createLogger({ level: env.LOG_LEVEL });
  const db = createPrismaClient(env.DATABASE_URL);
  const redis = await connectRedis(env.REDIS_URL, logger);
  const h5p = await createH5pRuntime({ env, logger, db, redis, s3: createS3Client(env) });
  const { app, lti } = createApp({ env, logger, db, redis, h5p });
  const synced = await syncLtiPlatforms(env.LTI_PLATFORMS, { platforms: lti.provider.platformManager, db });
  logger.info(synced, 'LTI platforms synchronised');
  const reencrypted = await reencryptPlatformKeys(db, new DataEncryption(env.DATA_ENCRYPTION_KEYS));
  logger.info({ reencrypted }, 'LTI platform keys on the current encryption key');
  const jobs = [h5p.cleanupJob, new LtiRecordCleanupJob({ db, redis, logger })];
  for (const job of jobs) job.start();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(env.PORT, () => resolve(listening));
  });
  logger.info({ port: env.PORT }, 'HVL Interaktiv server listening');
  return {
    server,
    stop: async () => {
      for (const job of jobs) job.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Promise.all([redis.quit(), db.$disconnect()]);
      logger.info('HVL Interaktiv server stopped');
    },
  };
}

async function main(): Promise<void> {
  let env: Env;
  try {
    env = loadEnv();
  } catch (error) {
    // SECURITY: the problem list names variables and rules only, never their values.
    if (error instanceof InvalidEnvironmentError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  const running = await startServer(env);
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
