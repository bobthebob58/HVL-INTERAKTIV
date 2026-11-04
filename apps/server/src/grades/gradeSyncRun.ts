/**
 * gradeSyncRun — one run of the grade worker: reopens stopped jobs that missed a stored result, claims the due grade
 * jobs, sends one policy score per learner and placement, and settles each claimed job by what Canvas answered.
 *
 * Why: D-104 coalesces per `(placement, learnerKey)`, applies the placement's attempt policy, sends one current score
 *      with `timestamp` = the moment of sending, and settles together. One current score means a late retry can never
 *      put an older result back, which AGS allows a platform to refuse anyway. D-104's amendment of 2026-11-04 (the
 *      step-3 security review) makes a job one learner's score in a placement, so a run's 50 claims are 50 learners
 *      and one learner's flood of results takes one of them; the score comes from the stored results at send time.
 * Spec: LTI-012
 * Invariants:
 *   - Reconciling (./gradeJobReconcile.ts) comes first, so a reopened job is sent in the same run.
 *   - One score post per learner and placement per run, whatever number of that learner's jobs is due (one, unless
 *     rows written per attempt before the amendment remain).
 *   - The score comes from every stored gradable result of the learner in the placement's activity and course, by
 *     the placement's stored policy (./gradeJobSend.ts, ./storedResultScores.ts, ./attemptPolicyScore.ts).
 *   - A job that took in a result during its send is not settled over: it is due again at once, or at its retry's
 *     time, and counted as `changed` (./gradeJobClaims.ts); a job another run claimed since is left to that run.
 *   - An unexpected error while sending one group is counted against that group as a retry (`internal`), so it is
 *     still limited by the 8 attempts and 24 hours; the other groups go on.
 *   - PRIVACY: the run reports and logs counts and reason codes, never a learner key, `sub`, score or URL (DATA-009).
 * Collaborators: ./gradeJobClaims.ts, ./gradeJobSend.ts, ./gradeJobReconcile.ts, ./gradeRetrySchedule.ts,
 *   ./AgsScoreClient.ts, ./GradeSyncWorker.ts (runs it on a leased timer).
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts, apps/server/test/grades/gradeSyncFaults.int.test.ts,
 *   apps/server/test/grades/gradeSyncWindow.int.test.ts, apps/server/test/grades/gradeSyncEdges.int.test.ts,
 *   apps/server/test/grades/gradeSyncFlood.int.test.ts, apps/server/test/grades/gradeJobReconcile.int.test.ts
 */
import type { Logger } from 'pino';
import type { AgsSendOutcome } from './agsSendOutcome.js';
import {
  claimDueGradeJobs,
  requeueChangedGradeJob,
  settleGradeJob,
  type ClaimedGradeJob,
} from './gradeJobClaims.js';
import { reconcileGradeJobs } from './gradeJobReconcile.js';
import { sendLearnerScore, type GradeJobSendDeps } from './gradeJobSend.js';
import { settlementFor } from './gradeRetrySchedule.js';

/** What a run needs. */
export interface GradeSyncRunDeps extends GradeJobSendDeps {
  readonly logger: Logger;
  /** A number in [0, 1) for the backoff's jitter; tests pass a fixed one. Defaults to `Math.random`. */
  readonly random?: () => number;
  /** At most this many jobs (learners) per run; default 50. */
  readonly claimLimit?: number;
  /** How long a claim holds its jobs from other runs; default 30 minutes, longer than a slow run. */
  readonly claimLeaseMs?: number;
  /** Only these placements' jobs, for a test that shares the database; production leaves it out. */
  readonly placementIds?: readonly string[];
}

/** What a run did, by count. */
export interface GradeSyncRunCounts {
  /** Stopped jobs reopened because they missed a stored result. */
  readonly reconciled: number;
  readonly claimed: number;
  /** Score posts that Canvas accepted. */
  readonly sent: number;
  readonly succeeded: number;
  readonly retried: number;
  readonly failed: number;
  readonly orphaned: number;
  /** Claimed jobs that changed before they were settled; they stay pending and are sent again. */
  readonly changed: number;
}

/** The default number of jobs one run claims. */
export const GRADE_SYNC_CLAIM_LIMIT = 50;
/**
 * The default claim lease. 50 posts that each time out after 10 seconds (Canvas down) take about 8 minutes; only a
 * run whose groups mostly need four or five slow requests (a 401, a new token, a 404 and its read) could outlive it,
 * and then another run may claim and send the rest again, which the settlement's claim check keeps harmless.
 */
export const GRADE_SYNC_CLAIM_LEASE_MS = 30 * 60 * 1000;

const SETTLED_COUNT = {
  succeeded: 'succeeded',
  retry: 'retried',
  failed: 'failed',
  orphaned: 'orphaned',
} as const;

/** The claimed jobs per learner and placement, in claim order. */
function byLearner(jobs: readonly ClaimedGradeJob[]): ClaimedGradeJob[][] {
  const groups = new Map<string, ClaimedGradeJob[]>();
  for (const job of jobs) {
    const key = `${job.placementId} ${job.learnerKey}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()];
}

/** Sends one group, turning an unexpected error into a bounded retry whose log names no learner. */
async function sendSafely(
  deps: GradeSyncRunDeps,
  group: readonly ClaimedGradeJob[],
  now: Date,
): Promise<AgsSendOutcome> {
  try {
    return await sendLearnerScore(deps, group, now);
  } catch (error) {
    // PRIVACY: the error's name only; a message could carry query values (DATA-009).
    const kind = error instanceof Error ? error.name : 'unknown';
    deps.logger.error(
      { event: 'grade.sync.error', jobs: group.length, kind },
      'grade send failed unexpectedly',
    );
    return { kind: 'retry', reason: 'internal' };
  }
}

/**
 * Runs the grade worker once.
 * @param deps - Database, encryption, score sender, logger and the run's settings.
 * @param now - The run's moment: what is reconciled and due, and the next attempt times.
 * @returns What the run did, by count.
 * @spec LTI-012
 */
export async function runGradeSync(deps: GradeSyncRunDeps, now: Date): Promise<GradeSyncRunCounts> {
  const random = deps.random ?? Math.random;
  const reconciled = await reconcileGradeJobs(deps.db, now, deps.placementIds);
  const jobs = await claimDueGradeJobs(deps.db, now, {
    limit: deps.claimLimit ?? GRADE_SYNC_CLAIM_LIMIT,
    leaseMs: deps.claimLeaseMs ?? GRADE_SYNC_CLAIM_LEASE_MS,
    ...(deps.placementIds ? { placementIds: deps.placementIds } : {}),
  });
  const counts = {
    reconciled,
    claimed: jobs.length,
    sent: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    orphaned: 0,
  };
  let changed = 0;
  for (const group of byLearner(jobs)) {
    const outcome = await sendSafely(deps, group, now);
    if (outcome.kind === 'sent') counts.sent += 1;
    else
      deps.logger.info(
        {
          event: 'grade.sync.outcome',
          outcome: outcome.kind,
          reason: 'reason' in outcome ? outcome.reason : undefined,
          jobs: group.length,
        },
        'grade not sent',
      );
    for (const job of group) {
      const settlement = settlementFor(job, outcome, now, random());
      if (await settleGradeJob(deps.db, job, settlement, now)) counts[SETTLED_COUNT[settlement.kind]] += 1;
      else {
        await requeueChangedGradeJob(deps.db, job, settlement, now);
        changed += 1;
      }
    }
  }
  return { ...counts, changed };
}
