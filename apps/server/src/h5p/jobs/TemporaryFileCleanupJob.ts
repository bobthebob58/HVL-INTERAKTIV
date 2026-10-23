/**
 * TemporaryFileCleanupJob — deletes expired editor uploads every 5 minutes, on exactly one node per interval.
 *
 * Why: H5P leaves an author's unsaved uploads in temporary storage until they expire. Every node runs this
 *      timer, but a Redis lease (`SET NX PX`, ../../jobs/LeasedIntervalJob.ts) lets only the first node in each
 *      interval do the work (H5P-004).
 * Spec: H5P-004
 * Invariants:
 *   - At most one run per interval cluster-wide: the lease lives slightly less than one interval.
 *   - `runOnce` never rejects: a failed lease or run is logged and the timer continues. A bucket lifecycle
 *     rule on S3_TEMPORARY_BUCKET (an operations task, see .env.example) is the backstop.
 * Collaborators: ../../jobs/LeasedIntervalJob.ts, H5PEditor.temporaryFileManager.cleanUp (S2 wiring),
 *   ../storage/S3TemporaryFileStorage.ts.
 * Tests: apps/server/test/h5p/sharedState.int.test.ts, apps/server/test/h5p/cleanupJob.test.ts,
 *   apps/server/test/jobs/LeasedIntervalJob.test.ts
 */
import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import { LeasedIntervalJob } from '../../jobs/LeasedIntervalJob.js';

/** Default interval: 5 minutes (H5P-004). */
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
/** Redis key of the lease. */
export const CLEANUP_LEASE_KEY = 'hvli:h5p:temporary-file-cleanup';

/** Inputs of the job. */
export interface TemporaryFileCleanupOptions {
  redis: Pick<RedisClientType, 'set'>;
  /** The actual cleanup, normally `h5pEditor.temporaryFileManager.cleanUp()`. */
  cleanUp: () => Promise<void>;
  logger: Logger;
  intervalMs?: number;
}

/** Periodic, cluster-wide single-run cleanup of temporary files. */
export class TemporaryFileCleanupJob extends LeasedIntervalJob {
  /**
   * @param options - Redis client, cleanup function, logger and interval.
   */
  constructor(options: TemporaryFileCleanupOptions) {
    super({
      name: 'temporary-file-cleanup',
      label: 'temporary file cleanup',
      leaseKey: CLEANUP_LEASE_KEY,
      intervalMs: options.intervalMs ?? CLEANUP_INTERVAL_MS,
      redis: options.redis,
      run: options.cleanUp,
      logger: options.logger,
    });
  }
}
