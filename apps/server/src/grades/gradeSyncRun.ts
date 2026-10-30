/**
 * gradeSyncRun — one run of the grade worker: claims the due grade jobs, sends one policy score per learner and
 * placement, and settles each claimed job by what Canvas answered.
 *
 * Why: D-104 coalesces due jobs per `(placement, learnerKey)`, applies the placement's attempt policy to all of that
 *      learner's attempt scores there, sends one current score with `timestamp` = the moment of sending, and settles
 *      the coalesced jobs together. One current score means a late retry can never put an older result back, which
 *      AGS allows a platform to refuse anyway.
 * Spec: LTI-012
 * Invariants:
 *   - One score post per learner and placement per run, whatever number of that learner's jobs is due.
 *   - The score comes from every job of the learner in the placement (sent, failed or orphaned too), by the
 *     placement's stored policy (./attemptPolicyScore.ts).
 *   - A job whose placement has no line item, or whose learner's `sub` is gone or unreadable, fails without a send.
 *   - An unexpected error while sending one group is counted against that group as a retry (`internal`), so it is
 *     still limited by the 8 attempts and 24 hours; the other groups go on.
 *   - PRIVACY: the `sub` is decrypted only to build the request; the run reports and logs counts and reason codes,
 *     never a learner key, `sub`, score or URL (DATA-009).
 * Collaborators: ./gradeJobClaims.ts, ./gradeRetrySchedule.ts, ./attemptPolicyScore.ts, ./AgsScoreClient.ts,
 *   ./GradeSyncWorker.ts (runs it on a leased timer).
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts, apps/server/test/grades/gradeSyncFaults.int.test.ts,
 *   apps/server/test/grades/gradeSyncWindow.int.test.ts
 */
import type { Logger } from 'pino';
import type { Database } from '../infra/prismaClient.js';
import type { DataEncryption } from '../security/keys/DataEncryption.js';
import type { AgsSendOutcome } from './agsSendOutcome.js';
import type { AgsScoreSender } from './AgsScoreClient.js';
import { policyScore } from './attemptPolicyScore.js';
import {
  claimDueGradeJobs,
  learnerAttemptScores,
  settleGradeJob,
  type ClaimedGradeJob,
} from './gradeJobClaims.js';
import { settlementFor } from './gradeRetrySchedule.js';

/** What a run needs. */
export interface GradeSyncRunDeps {
  readonly db: Database;
  readonly encryption: Pick<DataEncryption, 'decrypt'>;
  readonly sender: AgsScoreSender;
  readonly logger: Logger;
  /** A number in [0, 1) for the backoff's jitter; tests pass a fixed one. Defaults to `Math.random`. */
  readonly random?: () => number;
  /** At most this many jobs per run; default 50. */
  readonly claimLimit?: number;
  /** How long a claim holds its jobs from other runs; default 30 minutes, longer than a slow run. */
  readonly claimLeaseMs?: number;
  /** Only these placements' jobs, for a test that shares the database; production leaves it out. */
  readonly placementIds?: readonly string[];
}

/** What a run did, by count. */
export interface GradeSyncRunCounts {
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
/** The default claim lease: 50 sends of at most three 10-second requests each fit with room to spare. */
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

/** Sends one learner's policy score for one placement. */
async function sendGroup(
  deps: GradeSyncRunDeps,
  group: readonly ClaimedGradeJob[],
  now: Date,
): Promise<AgsSendOutcome> {
  const [first] = group;
  if (first === undefined) throw new RangeError('a group has at least one job');
  const placement = await deps.db.ltiPlacement.findUnique({
    where: { id: first.placementId },
    select: { platformId: true, lineItemUrl: true, attemptPolicy: true, masteryThreshold: true },
  });
  if (!placement?.lineItemUrl) return { kind: 'failed', reason: 'no-line-item' };
  // WHY: the newest result's `sub`; a learner's `sub` is the same on every job of one placement.
  const withSub = [...group].reverse().find((job) => job.ltiSubEncrypted !== null);
  if (!withSub?.ltiSubEncrypted) return { kind: 'failed', reason: 'no-subject' };
  let userId: string;
  try {
    userId = deps.encryption.decrypt('grade-lti-sub', Buffer.from(withSub.ltiSubEncrypted)).toString('utf8');
  } catch {
    // WHY: a key removed from DATA_ENCRYPTION_KEYS will not come back; retrying cannot help.
    return { kind: 'failed', reason: 'subject-unreadable' };
  }
  const attempts = await learnerAttemptScores(deps.db, first.placementId, first.learnerKey);
  return deps.sender.postScore({
    platformId: placement.platformId,
    lineItemUrl: placement.lineItemUrl,
    userId,
    scoreGiven: policyScore(placement, attempts),
    timestamp: now,
  });
}

/**
 * Runs the grade worker once.
 * @param deps - Database, encryption, score sender, logger and the run's settings.
 * @param now - The run's moment: what is due, the score's timestamp and the next attempt times.
 * @returns What the run did, by count.
 * @spec LTI-012
 */
export async function runGradeSync(deps: GradeSyncRunDeps, now: Date): Promise<GradeSyncRunCounts> {
  const random = deps.random ?? Math.random;
  const jobs = await claimDueGradeJobs(deps.db, now, {
    limit: deps.claimLimit ?? GRADE_SYNC_CLAIM_LIMIT,
    leaseMs: deps.claimLeaseMs ?? GRADE_SYNC_CLAIM_LEASE_MS,
    ...(deps.placementIds ? { placementIds: deps.placementIds } : {}),
  });
  const counts = {
    claimed: jobs.length,
    sent: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    orphaned: 0,
    changed: 0,
  };
  for (const group of byLearner(jobs)) {
    let outcome: AgsSendOutcome;
    try {
      outcome = await sendGroup(deps, group, now);
    } catch (error) {
      // PRIVACY: the error's name only; a message could carry query values (DATA-009).
      const kind = error instanceof Error ? error.name : 'unknown';
      deps.logger.error(
        { event: 'grade.sync.error', jobs: group.length, kind },
        'grade send failed unexpectedly',
      );
      outcome = { kind: 'retry', reason: 'internal' };
    }
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
      const written = await settleGradeJob(deps.db, job, settlement, now);
      counts[written ? SETTLED_COUNT[settlement.kind] : 'changed'] += 1;
    }
  }
  return counts;
}
