/**
 * redisClient — creates and connects the Redis client shared by the H5P cache, locks and jobs.
 *
 * Why: every node must see the same content-type cache, locks and job leases (H5P-004); one factory keeps
 *      connection settings and error logging the same everywhere.
 * Spec: H5P-004
 * Invariants: connection errors are logged without the URL (it may contain a password).
 * Collaborators: ../h5p/h5pStorage.ts, ../h5p/jobs/TemporaryFileCleanupJob.ts, ../config/env.ts.
 * Tests: apps/server/test/h5p/sharedState.int.test.ts
 */
import { createClient, type RedisClientType } from 'redis';
import type { Logger } from 'pino';

/** The Redis client type used across the server. */
export type Redis = RedisClientType;

/**
 * Creates and connects a Redis client.
 * @param url - REDIS_URL.
 * @param logger - Logger for connection errors.
 * @returns A connected client; call `quit()` on shutdown.
 */
export async function connectRedis(url: string, logger?: Logger): Promise<Redis> {
  const client = createClient({ url }) as Redis;
  // SECURITY: log only the error, never the URL, which may contain the Redis password.
  client.on('error', (error: Error) => logger?.error({ err: error }, 'redis connection error'));
  await client.connect();
  return client;
}
