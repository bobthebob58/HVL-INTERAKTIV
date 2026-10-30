/**
 * gradeSyncRetry — sends a placement's failed grade-sync jobs again: each becomes pending and due now, except one
 * whose encrypted Canvas user ID is gone; the retry is audited with its counts.
 *
 * Why: LTI-012's acceptance lets authors retry failed jobs, from the activity page or `/app/play` (D-104). A job
 *      that never succeeded loses its encrypted `sub` 30 days after it stopped (D-104, DATA-002); it cannot be sent
 *      without it, so it stays failed, and the learner's next scored play makes a new job. Every retry is audited
 *      (DATA-007).
 * Spec: LTI-012, DATA-007, DATA-002
 * Invariants:
 *   - Only `failed` jobs of the one placement change. `orphaned` jobs are never retried (LTI-012, D-104): the line
 *     item is gone, so a retry could only fail again.
 *   - A requeued job is pending, due at once, with no stop time, error or attempts counted, so the worker gives it
 *     D-104's full budget again.
 *   - The update, the count of jobs that must stay failed and the audit record are one transaction, so the audit's
 *     counts are the ones applied.
 *   - PRIVACY: the audit names the placement, the counts and the mode only: no learner key, `sub` or score (DATA-007).
 * Collaborators: ./gradeSyncRoutes.ts (the caller, after the scope and rate-limit checks), ../../infra/prismaClient.ts,
 *   the grade worker (claims the requeued jobs, D-104).
 * Tests: apps/server/test/grades/status/gradeSyncRetry.int.test.ts
 */
import type { GradeSyncRetryResponse } from '@hvl-interaktiv/api-contract';
import type { AuthMode } from '../../auth/Principal.js';
import type { Database } from '../../infra/prismaClient.js';

/** The audit action of a retry. */
export const GRADE_SYNC_RETRY_ACTION = 'content.gradeSync.retry';

/** Who retries which placement, and when. */
export interface GradeSyncRetryRequest {
  readonly placementId: string;
  /** The `User.id` of the author who asked. */
  readonly actorUserId: string;
  /** How the author signed in, for the audit record. */
  readonly mode: AuthMode;
  /** The moment of the request: the requeued jobs are due then. */
  readonly now: Date;
}

/**
 * Requeues a placement's failed jobs that can still be sent, and audits the retry.
 * @param db - The database.
 * @param request - The placement (already checked to be one the author may see), the author and the time.
 * @returns How many jobs are pending again, and how many must stay failed.
 * @spec LTI-012
 */
export async function retryFailedJobs(
  db: Database,
  request: GradeSyncRetryRequest,
): Promise<GradeSyncRetryResponse> {
  const { placementId, now } = request;
  return db.$transaction(async (tx) => {
    // PRIVACY: a job without its encrypted `sub` cannot be sent (D-104); it is counted, never touched.
    const stillFailed = await tx.gradeSyncJob.count({
      where: { placementId, status: 'failed', ltiSubEncrypted: null },
    });
    const { count: requeued } = await tx.gradeSyncJob.updateMany({
      where: { placementId, status: 'failed', ltiSubEncrypted: { not: null } },
      data: { status: 'pending', nextAttemptAt: now, attempts: 0, lastError: null, terminalAt: null },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: request.actorUserId,
        action: GRADE_SYNC_RETRY_ACTION,
        targetType: 'LtiPlacement',
        targetId: placementId,
        details: { requeued, stillFailed, mode: request.mode },
      },
    });
    return { requeued, stillFailed };
  });
}
