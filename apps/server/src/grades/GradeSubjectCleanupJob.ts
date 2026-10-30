/**
 * GradeSubjectCleanupJob — removes the encrypted LTI `sub` from grade jobs 30 days after they stopped, every hour, on
 * one server node per interval.
 *
 * Why: `GradeSyncJob.ltiSubEncrypted` is the only raw learner ID kept beyond a launch's 24 hours; AGS needs it as
 *      `userId`. DATA-002 deletes it 30 days after success; D-104 does the same after a job failed or was orphaned,
 *      since a job that never succeeds must not keep it longer. A Redis lease (../jobs/LeasedIntervalJob.ts) keeps the
 *      work to one node.
 * Spec: DATA-002, LTI-012
 * Invariants:
 *   - Clears `ltiSubEncrypted` (sets it to null) on jobs whose status is `succeeded`, `failed` or `orphaned` and
 *     whose `terminalAt` is 30 days or more before the run's moment; nothing else changes, and no row is deleted.
 *   - A pending job keeps its `sub`, whatever its age: it still has to be sent.
 *   - Uses the tick's moment from the job's injectable clock, or the one `runOnce(now)` names; logs only the count.
 * Collaborators: ../jobs/LeasedIntervalJob.ts, ./gradeJobClaims.ts (sets `terminalAt`), ../server/main.ts.
 * Tests: apps/server/test/grades/gradeSubjectCleanup.int.test.ts
 */
import type { Logger } from 'pino';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import type { JobClock } from '../jobs/jobClock.js';
import { LeasedIntervalJob } from '../jobs/LeasedIntervalJob.js';

/** How long after a job stopped its `sub` is kept (DATA-002, D-104). */
export const GRADE_SUBJECT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Default interval: one hour. */
export const GRADE_SUBJECT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
/** Redis key of the lease. */
export const GRADE_SUBJECT_CLEANUP_LEASE_KEY = 'hvli:grades:subject-cleanup';

/**
 * Clears the encrypted `sub` of every grade job that stopped 30 days or more ago.
 * @param db - The database.
 * @param now - The current time.
 * @returns How many jobs lost their `sub`.
 * @spec DATA-002
 */
export async function clearExpiredGradeSubjects(
  db: Pick<Database, 'gradeSyncJob'>,
  now: Date,
): Promise<number> {
  const cutoff = new Date(now.getTime() - GRADE_SUBJECT_RETENTION_MS);
  // PRIVACY: the raw learner ID goes 30 days after the job stopped, whatever its outcome (DATA-002, D-104).
  const { count } = await db.gradeSyncJob.updateMany({
    where: {
      status: { in: ['succeeded', 'failed', 'orphaned'] },
      terminalAt: { lte: cutoff },
      ltiSubEncrypted: { not: null },
    },
    data: { ltiSubEncrypted: null },
  });
  return count;
}

/** Inputs of the job. */
export interface GradeSubjectCleanupOptions {
  readonly db: Pick<Database, 'gradeSyncJob'>;
  /** Redis client that holds the lease. */
  readonly redis: Pick<Redis, 'set'>;
  readonly logger: Logger;
  /** Time between runs; defaults to one hour. */
  readonly intervalMs?: number;
  /** The clock; tests pass a fixed one. */
  readonly clock?: JobClock;
}

/** Periodic, cluster-wide single-run cleanup of grade jobs' LTI subjects. */
export class GradeSubjectCleanupJob extends LeasedIntervalJob {
  /**
   * @param options - Database, Redis client, logger, and an optional interval and clock.
   */
  constructor(options: GradeSubjectCleanupOptions) {
    super({
      name: 'grade-subject-cleanup',
      label: 'grade subject cleanup',
      leaseKey: GRADE_SUBJECT_CLEANUP_LEASE_KEY,
      intervalMs: options.intervalMs ?? GRADE_SUBJECT_CLEANUP_INTERVAL_MS,
      redis: options.redis,
      run: async (now) => ({ cleared: await clearExpiredGradeSubjects(options.db, now) }),
      logger: options.logger,
      ...(options.clock ? { clock: options.clock } : {}),
    });
  }
}
