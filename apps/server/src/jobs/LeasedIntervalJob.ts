/**
 * LeasedIntervalJob — runs a piece of work on a timer, on exactly one server node per interval.
 *
 * Why: every node runs the same timers, but cleanups such as expired H5P uploads (H5P-004) and expired ltijs
 *      records (LTI-002, D-052) must run once per interval cluster-wide. A Redis lease (`SET NX PX`) lets only
 *      the first node in each interval do the work; the others skip.
 * Spec: H5P-004, LTI-002
 * Invariants:
 *   - At most one run per interval cluster-wide: the lease lives slightly less than one interval.
 *   - `runOnce` never rejects: a failed lease or a failed run is logged and the timer continues.
 *   - Log lines carry only the job name and the numbers the work reports; anything else it returns is dropped,
 *     and a count can never replace the job name.
 *   - The timer is `unref`'d, so a job never keeps the process alive on its own.
 * Collaborators: ../h5p/jobs/TemporaryFileCleanupJob.ts, ../lti/storage/LtiRecordCleanupJob.ts,
 *   ../infra/redisClient.ts.
 * Tests: apps/server/test/jobs/LeasedIntervalJob.test.ts, apps/server/test/h5p/cleanupJob.test.ts,
 *   apps/server/test/h5p/sharedState.int.test.ts, apps/server/test/lti/storage/LtiRecordCleanupJob.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Redis } from '../infra/redisClient.js';

/** Counts a run may report, e.g. `{ nonces: 3 }`; they are logged with the job name. */
export type JobRunCounts = Readonly<Record<string, number>>;

/** Inputs of a leased interval job. */
export interface LeasedIntervalJobOptions {
  /** Stable job name, logged as the `job` field, e.g. `temporary-file-cleanup`. */
  readonly name: string;
  /** Words that start each log message, e.g. `temporary file cleanup`. */
  readonly label: string;
  /** Redis key of the lease; one key per job, shared by every node. */
  readonly leaseKey: string;
  /** Time between runs in milliseconds. */
  readonly intervalMs: number;
  /** Redis client that holds the lease. */
  readonly redis: Pick<Redis, 'set'>;
  /** The work; it may return counts to log. */
  readonly run: () => Promise<JobRunCounts | void>;
  /** Logger for outcomes and failures. */
  readonly logger: Logger;
}

/** What one tick did on this node. */
export type JobTickOutcome = 'ran' | 'skipped';

/** The numbers among what a run returned; anything else, e.g. a row a run returned by mistake, is dropped. */
const numericCounts = (result: unknown): Record<string, number> =>
  // PRIVACY: the type alone does not stop a run from returning data; only numbers ever reach the log (DATA-009).
  Object.fromEntries(
    Object.entries(typeof result === 'object' && result !== null ? result : {}).filter(
      ([, value]) => typeof value === 'number',
    ),
  );

/** A timer whose work runs on one node per interval, guarded by a Redis lease. */
export class LeasedIntervalJob {
  private timer: NodeJS.Timeout | undefined;
  /** WHY: a random value per instance shows in Redis which node holds the lease. */
  private readonly nodeId = randomUUID();

  /**
   * @param job - Name, lease key, interval, Redis client, work and logger.
   */
  constructor(private readonly job: LeasedIntervalJobOptions) {}

  /**
   * Runs the work if no other node has run it in this interval.
   * @returns `ran` when this node did the work (even if the work failed), `skipped` when another node holds
   *   the lease or Redis could not be reached. It never rejects.
   */
  async runOnce(): Promise<JobTickOutcome> {
    const { name, label, logger } = this.job;
    try {
      // WHY: the lease expires 1 % before the next tick, so clock drift cannot skip a whole interval.
      const lease = await this.job.redis.set(this.job.leaseKey, this.nodeId, {
        NX: true,
        PX: Math.max(1, Math.floor(this.job.intervalMs * 0.99)),
      });
      if (lease !== 'OK') return 'skipped';
    } catch (error) {
      // WHY: a Redis outage must not crash the server; the next tick tries again.
      logger.error({ job: name, err: error }, `${label} lease failed`);
      return 'skipped';
    }
    try {
      const counts = numericCounts(await this.job.run());
      logger.info({ ...counts, job: name }, `${label} done`);
    } catch (error) {
      logger.error({ job: name, err: error }, `${label} failed`);
    }
    return 'ran';
  }

  /** Starts the timer; it does not keep the process alive on its own. Calling it twice changes nothing. */
  start(): void {
    this.timer ??= setInterval(() => void this.runOnce(), this.job.intervalMs).unref();
  }

  /** Stops the timer. */
  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
