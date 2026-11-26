/**
 * redisClient — creates and connects the Redis client shared by the H5P cache, locks, limits, sessions and jobs.
 *
 * Why: every node must see the same content-type cache, locks and job leases (H5P-004); one factory keeps
 *      connection settings and error logging the same everywhere. While Redis cannot be reached, the client's own
 *      default is to keep every command in a list without a limit and send it when the connection is back: requests
 *      then wait and pile up, and a count meant for one minute is added minutes later. The limits and the sessions
 *      are written to fail such a request (LTI-011), so the client refuses the command at once (D-144).
 * Spec: H5P-004, LTI-011, NFR-002
 * Invariants:
 *   - Connection errors are logged without the URL (it may contain a password).
 *   - A command, a transaction or a script sent while the connection is down rejects at once with the client's
 *     `ClientOfflineError`; nothing is kept to be sent later. The client goes on reconnecting by itself (at most
 *     half a second between tries), and the first command after that is sent as usual.
 *   - A command that was already sent when the connection broke rejects with the connection's error, as before.
 * Collaborators: ../h5p/h5pStorage.ts, ../h5p/jobs/TemporaryFileCleanupJob.ts, ../config/env.ts,
 *   ../server/healthRoutes.ts (its PING is refused at once, so the node reports itself unavailable).
 * Tests: apps/server/test/h5p/sharedState.int.test.ts, apps/server/test/infra/redisOutage.int.test.ts
 */
import { ClientOfflineError, createClient, type RedisClientType } from 'redis';
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
  // WHY: without the offline queue a command sent while the connection is down is refused, not kept (D-144).
  const client = createClient({ url, disableOfflineQueue: true }) as Redis;
  // UPSTREAM: https://github.com/redis/node-redis/blob/client%401.6.1/packages/client/lib/client/index.ts
  // (`multiExecutor`): node-redis 4.7.1 applies `disableOfflineQueue` to single commands and scripts but not to
  // `multi().exec()`, which it puts in the queue whenever the client is open. The rate limits count in
  // transactions, so the same rule is applied to them here; remove this when the client does it itself.
  const execute = client.multiExecutor.bind(client);
  client.multiExecutor = (...transaction) =>
    client.isReady ? execute(...transaction) : Promise.reject(new ClientOfflineError());
  // SECURITY: log only the error, never the URL, which may contain the Redis password.
  client.on('error', (error: Error) => logger?.error({ err: error }, 'redis connection error'));
  await client.connect();
  return client;
}
