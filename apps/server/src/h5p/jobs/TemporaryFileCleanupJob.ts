/**
 * TemporaryFileCleanupJob — deletes expired editor uploads every 5 minutes, on exactly one node per interval.
 *
 * Why: H5P leaves an author's unsaved uploads in temporary storage until they expire. Every node runs this
 *      timer, but a Redis lease (`SET NX PX`) lets only the first node in each interval do the work (H5P-004).
 * Spec: H5P-004
 * Invariants:
 *   - At most one run per interval cluster-wide: the lease lives slightly less than one interval.
 *   - A failed run is logged and does not stop the timer; the S3 lifecycle rule is the backstop.
 * Collaborators: H5PEditor.temporaryFileManager.cleanUp (S2 wiring), ../storage/S3TemporaryFileStorage.ts.
 * Tests: apps/server/test/h5p/storage.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';

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
export class TemporaryFileCleanupJob {
  private timer: NodeJS.Timeout | undefined;
  private readonly nodeId = randomUUID();
  private readonly intervalMs: number;

  /**
   * @param options - Redis client, cleanup function, logger and interval.
   */
  constructor(private readonly options: TemporaryFileCleanupOptions) {
    this.intervalMs = options.intervalMs ?? CLEANUP_INTERVAL_MS;
  }

  /**
   * Runs the cleanup if no other node has run it in this interval.
   * @returns `ran` when this node did the work, `skipped` when another node holds the lease.
   */
  async runOnce(): Promise<'ran' | 'skipped'> {
    // WHY: the lease expires 1 % before the next tick, so clock drift cannot skip a whole interval.
    const lease = await this.options.redis.set(CLEANUP_LEASE_KEY, this.nodeId, {
      NX: true,
      PX: Math.max(1, Math.floor(this.intervalMs * 0.99)),
    });
    if (lease !== 'OK') return 'skipped';
    try {
      await this.options.cleanUp();
      this.options.logger.info({ job: 'temporary-file-cleanup' }, 'temporary files cleaned up');
    } catch (error) {
      this.options.logger.error(
        { job: 'temporary-file-cleanup', err: error },
        'temporary file cleanup failed',
      );
    }
    return 'ran';
  }

  /** Starts the timer; it does not keep the process alive on its own. */
  start(): void {
    this.timer ??= setInterval(() => void this.runOnce(), this.intervalMs).unref();
  }

  /** Stops the timer. */
  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
