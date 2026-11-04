/**
 * gradeJobUpsert — writes a learner's one grade job in a placement, or takes a new result into the one that is there.
 *
 * Why: LTI-012 queues a score for each scored root result, idempotently. D-104's amendment of 2026-11-04 (the step-3
 *      security review) keeps one job per `(placement, learnerKey)`: a job per attempt let one learner flood the queue
 *      with made-up results, so the job is now the learner's score in that gradebook column, and the worker reads the
 *      stored results when it sends (./storedResultScores.ts). Taking a result in twice changes nothing but the
 *      job's state, so LTI-012's idempotency per `(placement, learnerKey, attemptId)` holds a fortiori.
 * Spec: LTI-012
 * Invariants:
 *   - One row per `idempotencyKey` = `<placementId>:<learnerKey>`; a concurrent first write of the same key ends as
 *     one row (the loser of the insert updates instead).
 *   - The existing row is locked (`FOR UPDATE`) while it is read and updated, so its status cannot change between.
 *   - The job takes the result in: `attemptId`, `scoreGiven`, `resultAt` (which the worker's settlement compares, so a
 *     result taken in during a send is sent again) and the encrypted `sub` of the request.
 *   - A pending job keeps its attempts and `nextAttemptAt` (a backoff or the worker's claim stays). A stopped job
 *     (succeeded, failed, orphaned) becomes pending at once with its attempts, `terminalAt`, `succeededAt` and
 *     `lastError` reset and `createdAt` set to now, the start of its new 24 hours (./gradeRetrySchedule.ts).
 *   - PRIVACY: the learner's `sub` arrives already encrypted (`grade-lti-sub`, DATA-002) and is the only learner ID
 *     written besides the pseudonym `learnerKey`.
 * Collaborators: ./GradeJobEnqueuer.ts (the caller), ./gradeJobClaims.ts (the worker's side of the same rows),
 *   ./gradeJobReconcile.ts (reopens a job in SQL by the same rules).
 * Tests: apps/server/test/grades/gradeJobEnqueuer.int.test.ts, apps/server/test/grades/gradeSyncWindow.int.test.ts
 */
import type { Database } from '../infra/prismaClient.js';

/** One gradable result to take into a learner's job. */
export interface GradeJobDraft {
  readonly placementId: string;
  readonly learnerKey: string;
  /** `<viewId>:<n>` of the result's attempt (D-115). */
  readonly attemptId: string;
  /** The result's `scaled × 100`. */
  readonly scoreGiven: number;
  /** The stored statement's timestamp. */
  readonly resultAt: Date;
  /** The year of the secret behind `learnerKey` (D-107). */
  readonly academicYear: number;
  /** The learner's LTI `sub`, encrypted for `grade-lti-sub`. */
  readonly ltiSubEncrypted: Uint8Array<ArrayBuffer>;
}

/** Whether the write made a new job or updated one. */
export type GradeJobWrite = 'created' | 'updated';

/**
 * The idempotency key of a learner's job in a placement (D-104's amendment of 2026-11-04).
 * @param placementId - `LtiPlacement.id`.
 * @param learnerKey - The learner's pseudonym.
 * @returns `<placementId>:<learnerKey>`.
 */
export const gradeJobIdempotencyKey = (placementId: string, learnerKey: string): string =>
  `${placementId}:${learnerKey}`;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/**
 * Creates the learner's job in the placement, or takes the result into it.
 * @param db - The database.
 * @param draft - The result.
 * @param now - The moment of the write: a new or reopened job's `createdAt` and `nextAttemptAt`.
 * @returns `created` or `updated`.
 * @spec LTI-012
 */
export async function upsertGradeJob(db: Database, draft: GradeJobDraft, now: Date): Promise<GradeJobWrite> {
  try {
    return await writeOnce(db, draft, now);
  } catch (error) {
    // WHY: two requests can both find no row and insert; the second sees the first's row on its second try.
    if (!isUniqueViolation(error)) throw error;
    return writeOnce(db, draft, now);
  }
}

async function writeOnce(db: Database, draft: GradeJobDraft, now: Date): Promise<GradeJobWrite> {
  const idempotencyKey = gradeJobIdempotencyKey(draft.placementId, draft.learnerKey);
  const result = {
    attemptId: draft.attemptId,
    scoreGiven: draft.scoreGiven,
    resultAt: draft.resultAt,
    ltiSubEncrypted: draft.ltiSubEncrypted,
  };
  return db.$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS "status" FROM "GradeSyncJob" WHERE "idempotencyKey" = ${idempotencyKey} FOR UPDATE`;
    if (current === undefined) {
      await tx.gradeSyncJob.create({
        data: { ...draft, idempotencyKey, status: 'pending', nextAttemptAt: now, createdAt: now },
      });
      return 'created';
    }
    // WHY: a new result after the job stopped is a new sending, with D-104's 8 attempts in 24 hours of its own.
    const reopen =
      current.status === 'pending'
        ? {}
        : {
            status: 'pending' as const,
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            terminalAt: null,
            succeededAt: null,
            lastError: null,
          };
    await tx.gradeSyncJob.update({ where: { idempotencyKey }, data: { ...result, ...reopen } });
    return 'updated';
  });
}
