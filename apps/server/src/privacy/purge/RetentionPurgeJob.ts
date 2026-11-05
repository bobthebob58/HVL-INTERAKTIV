/**
 * RetentionPurgeJob — the yearly purge as a leased job: checks every hour, on one server node, whether the configured
 * run date (default 31 August, Oslo) has come for the year that ended, and then logs the plan and runs the purge once.
 * It also names, by year, the pseudonym secrets still configured for years the purge has completed.
 *
 * Why: DATA-003 runs the purge as a scheduled job on a configured date. D-107 has a leased job run it on one node, and
 *      the operations step that destroys the year's secret show when it was forgotten; its amendment of 2026-11-04
 *      checks hourly so a server that is down on the day purges at its first check after, and logs the dry run first.
 * Spec: DATA-003, DATA-002, DATA-007
 * Invariants:
 *   - SPEC-DEVIATION: D-107 — the purge runs from the run date (default 31 August, never before) for the year that
 *     ended on 31 July, and the job does not destroy the year's secret: it warns until operations have removed it.
 *   - A check before the run date, or after a completed real run for the ended year (audit log), deletes nothing.
 *   - A run's first log line is its plan (the dry run's counts per table, `dryRun: true`); the job's own line then
 *     carries the counts of the real run. Both carry numbers, the job name and nothing else.
 *   - The warning names years only, never a secret (DATA-009): at `start()` and after each completed real run.
 *   - One moment per check: `runOnce(now)`'s argument or the injectable clock (../../jobs/jobClock.ts).
 * Collaborators: ../../jobs/LeasedIntervalJob.ts, ./purgeCalendar.ts, ./retentionPurge.ts, ./purgeAudit.ts,
 *   ../minimumGroupSize.ts, ../pseudonymSecrets.ts, ../../server/main.ts (starts it), docs/ops/yearly-purge.md.
 * Tests: apps/server/test/privacy/purge/retentionPurgeJob.int.test.ts,
 *   apps/server/test/privacy/purge/retentionPurgeJobRetry.int.test.ts
 */
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import type { Database } from '../../infra/prismaClient.js';
import type { Redis } from '../../infra/redisClient.js';
import type { JobClock } from '../../jobs/jobClock.js';
import { LeasedIntervalJob, type JobRunCounts, type JobTickOutcome } from '../../jobs/LeasedIntervalJob.js';
import { minimumGroupSize } from '../minimumGroupSize.js';
import { DEFAULT_PURGE_RUN_DATE, isPurgeDue, purgeScopeAt, type PurgeRunDate } from './purgeCalendar.js';
import { hasCompletedPurge, latestPurgedYear, staleSecretYears } from './purgeAudit.js';
import { planRetentionPurge, runRetentionPurge } from './retentionPurge.js';

/** Time between checks: one hour. */
export const RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000;
/** Redis key of the lease. */
export const RETENTION_PURGE_LEASE_KEY = 'hvli:privacy:retention-purge';
/** The job's name in its log lines. */
const JOB = 'retention-purge';

/**
 * The configuration the job reads. The server's `Env` always holds `PURGE_RUN_DATE` (default 31 August); it is
 * optional here so a test can leave it out.
 */
export type PurgeEnv = Pick<Env, 'MIN_GROUP_SIZE' | 'PSEUDONYM_SECRETS'> & {
  readonly PURGE_RUN_DATE?: PurgeRunDate;
};

/** Inputs of the job. */
export interface RetentionPurgeJobOptions {
  readonly db: Database;
  /** Redis client that holds the lease. */
  readonly redis: Pick<Redis, 'set'>;
  readonly logger: Logger;
  /** *k*, the run date and the configured secrets' years. */
  readonly env: PurgeEnv;
  /** The clock; tests pass a fixed one. */
  readonly clock?: JobClock;
}

/** The yearly purge, checked hourly on one node. */
export class RetentionPurgeJob {
  private readonly job: LeasedIntervalJob;
  /** The ended year whose completed purge this instance has seen, so later checks need no query. */
  private purgedYear: number | undefined;

  /**
   * @param options - Database, Redis client, logger, configuration and an optional clock.
   */
  constructor(private readonly options: RetentionPurgeJobOptions) {
    this.job = new LeasedIntervalJob({
      name: JOB,
      label: 'retention purge check',
      leaseKey: RETENTION_PURGE_LEASE_KEY,
      intervalMs: RETENTION_PURGE_INTERVAL_MS,
      redis: options.redis,
      run: (now) => this.check(now),
      logger: options.logger,
      ...(options.clock ? { clock: options.clock } : {}),
    });
  }

  /**
   * Runs one check on the lease.
   * @param now - The moment; by default the clock's.
   * @returns `ran` when this node checked, `skipped` when another holds the lease. It never rejects.
   */
  runOnce(now?: Date): Promise<JobTickOutcome> {
    return now === undefined ? this.job.runOnce() : this.job.runOnce(now);
  }

  /** Starts the hourly checks and, once, the warning about secrets of purged years. */
  start(): void {
    this.job.start();
    void this.warnAboutPurgedSecrets();
  }

  /** Stops the checks. */
  stop(): void {
    this.job.stop();
  }

  /**
   * Logs, as a warning, the years of configured secrets whose purge has completed (D-107: operations destroy them).
   * @returns The years named; empty when there are none or the audit log could not be read (that is logged).
   * @spec DATA-002
   */
  async warnAboutPurgedSecrets(): Promise<number[]> {
    const { db, logger, env } = this.options;
    try {
      const years = staleSecretYears(env.PSEUDONYM_SECRETS.keys(), await latestPurgedYear(db));
      // PRIVACY: years only; a secret's value never reaches a log line (DATA-009).
      if (years.length > 0) {
        logger.warn(
          { job: JOB, years },
          'pseudonym secrets of purged academic years are still configured; remove them (docs/ops/yearly-purge.md)',
        );
      }
      return years;
    } catch (error) {
      logger.error({ job: JOB, err: error }, 'retention purge could not read its audit events');
      return [];
    }
  }

  /** One check: nothing before the run date or after a completed purge; otherwise the plan, then the run. */
  private async check(now: Date): Promise<JobRunCounts> {
    const { db, logger, env } = this.options;
    if (!isPurgeDue(env.PURGE_RUN_DATE ?? DEFAULT_PURGE_RUN_DATE, now)) return { due: 0 };
    const scope = purgeScopeAt(now);
    if (this.purgedYear === scope.endedYear || (await hasCompletedPurge(db, scope.endedYear))) {
      this.purgedYear = scope.endedYear;
      return { due: 0 };
    }
    const plan = await planRetentionPurge(db, scope);
    // PRIVACY: the plan is counts per table, the ended year and the job's name (DATA-009).
    logger.info(
      { job: JOB, dryRun: true, endedYear: scope.endedYear, ...plan.counts },
      'retention purge plan',
    );
    const groupSize = minimumGroupSize(env.MIN_GROUP_SIZE);
    const result = await runRetentionPurge({ db, groupSize }, { now, dryRun: false, trigger: 'job' });
    this.purgedYear = scope.endedYear;
    await this.warnAboutPurgedSecrets();
    return { due: 1, endedYear: result.endedYear, ...result.counts };
  }
}
