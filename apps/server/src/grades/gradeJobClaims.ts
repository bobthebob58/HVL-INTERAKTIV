/**
 * gradeJobClaims — the grade worker's side of `GradeSyncJob`: claiming due jobs and writing what a send came to.
 *
 * Why: D-104's worker "claims due jobs (`FOR UPDATE SKIP LOCKED` on the new `nextAttemptAt`)". A claim moves the
 *      jobs' `nextAttemptAt` a lease ahead in one short statement, so no row lock is held while Canvas answers, a run
 *      on another node skips them, and a node that dies mid-send leaves them due again when the lease ends. D-104's
 *      amendment of 2026-11-04 makes a job one learner's score in a placement, so a claim of 50 jobs is 50 learners,
 *      and a job that takes in a result during its send is due again at once rather than after the lease.
 * Spec: LTI-012
 * Invariants:
 *   - Only `pending` jobs whose `nextAttemptAt` has come are claimed, oldest due first and at most the limit per
 *     claim, whatever plan PostgreSQL picks; rows another transaction holds are skipped, never waited for.
 *   - A settlement is written only while the job is still exactly as claimed: `pending`, with the claim's
 *     `nextAttemptAt`, attempt, score and result time. A job the enqueuer changed meanwhile (./gradeJobUpsert.ts)
 *     stays pending and becomes due at once (or at its retry's time, the send counted), so the new result goes at
 *     the next run; a job another run has claimed since is left to that run.
 *   - Every settlement counts the send in `attempts`; a final one sets `terminalAt` and clears `nextAttemptAt`, and
 *     `succeeded` also sets `succeededAt`. `lastError` holds a fixed reason code only (DATA-009).
 * Collaborators: ./gradeSyncRun.ts (the caller), ./gradeRetrySchedule.ts (the settlements), ./gradeJobUpsert.ts.
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts, apps/server/test/grades/gradeSyncWindow.int.test.ts,
 *   apps/server/test/grades/gradeSyncEdges.int.test.ts, apps/server/test/grades/gradeSyncFlood.int.test.ts
 */
import { Prisma } from '../generated/prisma/client.js';
import type { Database } from '../infra/prismaClient.js';
import type { GradeJobSettlement } from './gradeRetrySchedule.js';

/** A job the worker claimed. */
export interface ClaimedGradeJob {
  readonly id: string;
  readonly placementId: string;
  readonly learnerKey: string;
  readonly attempts: number;
  readonly createdAt: Date;
  /** The attempt, score and time of the result the job took in last; the settlement compares them. */
  readonly attemptId: string;
  readonly scoreGiven: number;
  readonly resultAt: Date;
  /** PRIVACY: the encrypted `sub`, decrypted only to send (DATA-002); null once cleared. */
  readonly ltiSubEncrypted: Uint8Array | null;
  /** The `nextAttemptAt` the claim wrote, which the settlement checks. */
  readonly claimedUntil: Date;
}

/**
 * Claims due jobs for one run.
 * @param db - The database.
 * @param now - The run's moment.
 * @param options - How many jobs at most, how long the claim holds them, and optionally the only placements to claim
 *   from (a test's own, so that it never sends another test's jobs; production claims from all).
 * @returns The claimed jobs, oldest due claimed first, sent in the order their sending began (`createdAt`).
 * @spec LTI-012
 */
export async function claimDueGradeJobs(
  db: Database,
  now: Date,
  options: { readonly limit: number; readonly leaseMs: number; readonly placementIds?: readonly string[] },
): Promise<ClaimedGradeJob[]> {
  const claimedUntil = new Date(now.getTime() + options.leaseMs);
  // WHY: `AT TIME ZONE 'UTC'` compares and stores the UTC wall time Prisma uses, whatever the session's time zone.
  const at = (moment: Date) => Prisma.sql`${moment.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;
  const only = options.placementIds
    ? Prisma.sql`AND "placementId" = ANY(${[...options.placementIds]}::uuid[])`
    : Prisma.empty;
  // WHY: a materialized CTE runs the locking subquery once. As `WHERE "id" IN (…)` the planner may make it the inner
  // side of a nested-loop semi join and rescan it for every row; each rescan skips the rows this statement has just
  // updated and returns the next due one, so one claim took every due job whatever the limit (seen in
  // gradeSyncFlood.int.test.ts with a plan made while the table looked empty).
  const rows = await db.$queryRaw<Omit<ClaimedGradeJob, 'claimedUntil'>[]>`
    WITH due AS MATERIALIZED (
      SELECT "id" FROM "GradeSyncJob"
      WHERE "status" = 'pending' AND "nextAttemptAt" <= ${at(now)} ${only}
      ORDER BY "nextAttemptAt", "id"
      LIMIT ${options.limit}::int
      FOR UPDATE SKIP LOCKED)
    UPDATE "GradeSyncJob" AS job SET "nextAttemptAt" = ${at(claimedUntil)}, "updatedAt" = ${at(now)}
    FROM due WHERE job."id" = due."id"
    RETURNING job."id", job."placementId", job."learnerKey", job."attempts", job."createdAt", job."attemptId",
      job."scoreGiven", job."resultAt", job."ltiSubEncrypted"`;
  return rows
    .map((row) => ({ ...row, claimedUntil }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
}

/** The columns a settlement writes. */
function settlementData(settlement: GradeJobSettlement, now: Date) {
  const attempts = { increment: 1 };
  switch (settlement.kind) {
    case 'succeeded':
      return {
        attempts,
        status: 'succeeded' as const,
        succeededAt: now,
        terminalAt: now,
        nextAttemptAt: null,
        lastError: null,
      };
    case 'orphaned':
      return {
        attempts,
        status: 'orphaned' as const,
        terminalAt: now,
        nextAttemptAt: null,
        lastError: 'line-item-gone',
      };
    case 'failed':
      return {
        attempts,
        status: 'failed' as const,
        terminalAt: now,
        nextAttemptAt: null,
        lastError: settlement.reason,
      };
    case 'retry':
      return { attempts, nextAttemptAt: settlement.nextAttemptAt, lastError: settlement.reason };
  }
}

/**
 * Writes what a send came to, if the job is still as it was claimed.
 * @param db - The database.
 * @param job - The claimed job.
 * @param settlement - What it becomes.
 * @param now - The moment of the send.
 * @returns True when written; false when the job had changed since the claim.
 * @spec LTI-012
 */
export async function settleGradeJob(
  db: Database,
  job: ClaimedGradeJob,
  settlement: GradeJobSettlement,
  now: Date,
): Promise<boolean> {
  const { count } = await db.gradeSyncJob.updateMany({
    where: {
      id: job.id,
      status: 'pending',
      nextAttemptAt: job.claimedUntil,
      attemptId: job.attemptId,
      scoreGiven: job.scoreGiven,
      resultAt: job.resultAt,
    },
    data: settlementData(settlement, now),
  });
  return count === 1;
}

/**
 * Makes a claimed job that took in a new result during its send due again, if no other run has claimed it since.
 * @param db - The database.
 * @param job - The claimed job, as it was claimed.
 * @param settlement - What the send came to: a retry keeps its backoff and counts the send; anything else is due now.
 * @param now - The moment of the send.
 * @returns True when written; false when another run holds the job now.
 * @spec LTI-012
 */
export async function requeueChangedGradeJob(
  db: Database,
  job: ClaimedGradeJob,
  settlement: GradeJobSettlement,
  now: Date,
): Promise<boolean> {
  // WHY: the score sent may lack the new result, so the job goes again; a retry's backoff still protects Canvas.
  const data =
    settlement.kind === 'retry'
      ? { attempts: { increment: 1 }, nextAttemptAt: settlement.nextAttemptAt, lastError: settlement.reason }
      : { nextAttemptAt: now };
  const { count } = await db.gradeSyncJob.updateMany({
    where: { id: job.id, status: 'pending', nextAttemptAt: job.claimedUntil },
    data,
  });
  return count === 1;
}
