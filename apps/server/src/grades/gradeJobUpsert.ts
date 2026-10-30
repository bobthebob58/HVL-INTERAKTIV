/**
 * gradeJobUpsert — writes one grade job per placement, learner and attempt, or updates the one that is there.
 *
 * Why: LTI-012 makes jobs idempotent per `(placement, learnerKey, attemptId)`; D-104 has "a later scored statement of
 *      the same attempt" update its job. D-115 makes that a forged result (`LTI-013` accepts the risk) or a duplicate
 *      the statement ID already stops, so the update must be safe, not clever: the job takes the new score, and a job
 *      that had stopped is sent again.
 * Spec: LTI-012
 * Invariants:
 *   - One row per `idempotencyKey` = `<placementId>:<learnerKey>:<attemptId>`; a concurrent first write of the same
 *     key ends as one row (the loser of the insert updates instead).
 *   - The existing row is locked (`FOR UPDATE`) while it is read and updated, so its status cannot change between.
 *   - A pending job keeps its attempts and `nextAttemptAt` (a backoff or the worker's claim stays); a stopped job
 *     (succeeded, failed, orphaned) becomes pending at once with its attempts, `terminalAt`, `succeededAt` and
 *     `lastError` reset. `createdAt` never changes, so the 24 hours of ./gradeRetrySchedule.ts still run from it.
 *   - PRIVACY: the learner's `sub` arrives already encrypted (`grade-lti-sub`, DATA-002) and is the only learner ID
 *     written besides the pseudonym `learnerKey`.
 * Collaborators: ./GradeJobEnqueuer.ts (the caller), ./gradeJobClaims.ts (the worker's side of the same rows).
 * Tests: apps/server/test/grades/gradeJobEnqueuer.int.test.ts
 */
import type { Database } from '../infra/prismaClient.js';

/** One gradable result to write as a job. */
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
 * The idempotency key of a job.
 * @param placementId - `LtiPlacement.id`.
 * @param learnerKey - The learner's pseudonym.
 * @param attemptId - The attempt.
 * @returns `<placementId>:<learnerKey>:<attemptId>`.
 */
export const gradeJobIdempotencyKey = (placementId: string, learnerKey: string, attemptId: string): string =>
  `${placementId}:${learnerKey}:${attemptId}`;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/**
 * Creates the job of a result, or updates the attempt's job.
 * @param db - The database.
 * @param draft - The result.
 * @param now - The moment of the write: a new job's `createdAt` and `nextAttemptAt`.
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
  const idempotencyKey = gradeJobIdempotencyKey(draft.placementId, draft.learnerKey, draft.attemptId);
  const result = {
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
    const reopen =
      current.status === 'pending'
        ? {}
        : {
            status: 'pending' as const,
            attempts: 0,
            nextAttemptAt: now,
            terminalAt: null,
            succeededAt: null,
            lastError: null,
          };
    await tx.gradeSyncJob.update({ where: { idempotencyKey }, data: { ...result, ...reopen } });
    return 'updated';
  });
}
