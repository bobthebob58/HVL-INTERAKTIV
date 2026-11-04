/**
 * gradeJobReconcile — reopens a stopped grade job whose learner has a gradable result stored after the job last took
 * one in: the result whose job write failed after its statements were stored.
 *
 * Why: the xAPI ingestion answers 202 once the statements are stored and hands the rows to the grade enqueuer after;
 *      when that write fails, a resend is skipped as a duplicate, so the result would never reach Canvas (the step-3
 *      security review, finding 4). D-104's amendment of 2026-11-04 reconciles on each worker run: a stopped job
 *      whose learner has a newer gradable result in the job's activity and course is reopened and takes it in, as the
 *      enqueuer would have done (./gradeJobUpsert.ts). A learner with no job has no `sub` in our records, so their
 *      lost first result waits for their next one, whose send reads every stored result (./storedResultScores.ts).
 * Spec: LTI-012
 * Invariants:
 *   - Only results stored between `RECONCILE_WINDOW_MS` and `RECONCILE_GRACE_MS` before the run are read: the grace
 *     leaves the ingestion's own job write time to finish, and the window keeps each run's read small.
 *   - Only `succeeded`, `failed` and `orphaned` jobs that still hold their encrypted `sub` are reopened, and only for a
 *     result stored after their `resultAt`; a pending job sends every stored result anyway.
 *   - A reopened job is as the enqueuer leaves one: pending and due now, attempts, `terminalAt`, `succeededAt` and
 *     `lastError` reset, `createdAt` now (its new 24 hours), and the newest such result's attempt, score and time,
 *     so it is not reopened again for the same result.
 *   - Gradable as ../xapi/xapiRootTests.ts's `isGradableResult` says, as in ./storedResultScores.ts; a placement's
 *     course is matched as D-103 stores it, `<platformId>:<contextId>`.
 *   - PRIVACY: returns a count only.
 * Collaborators: ./gradeSyncRun.ts (runs it before claiming), ./gradeJobUpsert.ts, ./storedResultScores.ts.
 * Tests: apps/server/test/grades/gradeJobReconcile.int.test.ts
 */
import { Prisma } from '../generated/prisma/client.js';
import type { Database } from '../infra/prismaClient.js';

/** How far back a run looks for results whose job write failed (D-104's amendment of 2026-11-04). */
export const RECONCILE_WINDOW_MS = 15 * 60 * 1000;
/** How old a result must be before a run reconciles it: the ingestion writes its job within this time. */
export const RECONCILE_GRACE_MS = 60 * 1000;

/**
 * Reopens the stopped jobs that missed a newer stored result.
 * @param db - The database.
 * @param now - The run's moment.
 * @param placementIds - Only these placements' jobs, for a test that shares the database; production leaves it out.
 * @returns How many jobs were reopened.
 * @spec LTI-012
 */
export async function reconcileGradeJobs(
  db: Database,
  now: Date,
  placementIds?: readonly string[],
): Promise<number> {
  // WHY: `AT TIME ZONE 'UTC'` compares and stores the UTC wall time Prisma uses, whatever the session's time zone.
  const at = (moment: Date) => Prisma.sql`${moment.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;
  const from = new Date(now.getTime() - RECONCILE_WINDOW_MS);
  const until = new Date(now.getTime() - RECONCILE_GRACE_MS);
  const only = placementIds ? Prisma.sql`AND p."id" = ANY(${[...placementIds]}::uuid[])` : Prisma.empty;
  return db.$executeRaw`
    WITH missed AS (
      SELECT DISTINCT ON (j."id") j."id" AS "jobId", s."attemptId", s."scaled", s."timestamp"
      FROM "XapiStatement" s
      JOIN "LtiPlacement" p
        ON p."contentId" = s."contentId" AND s."contextId" = p."platformId"::text || ':' || p."contextId"
      JOIN "GradeSyncJob" j ON j."placementId" = p."id" AND j."learnerKey" = s."learnerKey"
      WHERE s."timestamp" > ${at(from)} AND s."timestamp" <= ${at(until)}
        AND s."subContentId" IS NULL AND s."verb" IN ('answered', 'completed')
        AND s."scoreMax" > 0 AND s."scaled" IS NOT NULL
        AND j."status" IN ('succeeded', 'failed', 'orphaned') AND j."ltiSubEncrypted" IS NOT NULL
        AND s."timestamp" > j."resultAt" ${only}
      ORDER BY j."id", s."timestamp" DESC, s."attemptId" DESC)
    UPDATE "GradeSyncJob" AS j SET
      "status" = 'pending', "attempts" = 0, "nextAttemptAt" = ${at(now)}, "createdAt" = ${at(now)},
      "terminalAt" = NULL, "succeededAt" = NULL, "lastError" = NULL, "updatedAt" = ${at(now)},
      "attemptId" = m."attemptId", "scoreGiven" = ROUND((m."scaled" * 10000)::numeric) / 100,
      "resultAt" = m."timestamp"
    FROM missed AS m
    WHERE j."id" = m."jobId" AND j."status" IN ('succeeded', 'failed', 'orphaned')`;
}
