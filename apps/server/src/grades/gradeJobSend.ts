/**
 * gradeJobSend — sends one learner's policy score for one placement: checks the placement's line item and the
 * learner's `sub`, reads the learner's stored results, and posts the score the placement's attempt policy gives.
 *
 * Why: D-104 sends one current score per learner and placement, with `timestamp` = the time of sending, so a late
 *      retry can never put an older result back. Its amendments of 2026-11-04 (the step-3 security review) read that
 *      score from the stored results at send time (./storedResultScores.ts) and check the line item's URL again here,
 *      before any token is asked for, since the URL came from a launch (./lineItemUrlPolicy.ts).
 * Spec: LTI-012, DATA-002
 * Invariants:
 *   - Fails without any request: `no-line-item` (the placement has none), `line-item-url` (its URL is not allowed for
 *     the platform), `no-subject` or `subject-unreadable` (the learner's `sub` is gone or no key reads it), and
 *     `no-result` (no stored gradable result in the placement's activity and course).
 *   - The `sub` is the newest job's that still has one; every job of one learner and placement carries the same.
 *   - A score's `timestamp` is the wall clock when it is sent, never earlier than the run's moment (a test's moment
 *     may lie ahead of the wall clock).
 *   - PRIVACY: the `sub` is decrypted only to build the request and never logged or returned (DATA-009).
 * Collaborators: ./gradeSyncRun.ts (the caller), ./lineItemUrlPolicy.ts, ./storedResultScores.ts,
 *   ./attemptPolicyScore.ts, ./AgsScoreClient.ts (`AgsScoreSender`).
 * Tests: apps/server/test/grades/gradeSyncEdges.int.test.ts, apps/server/test/grades/gradeSyncWorker.int.test.ts
 */
import type { Database } from '../infra/prismaClient.js';
import type { DataEncryption } from '../security/keys/DataEncryption.js';
import type { AgsSendOutcome } from './agsSendOutcome.js';
import type { AgsScoreSender } from './AgsScoreClient.js';
import { policyScore } from './attemptPolicyScore.js';
import type { ClaimedGradeJob } from './gradeJobClaims.js';
import { lineItemUrlRefusal, type LineItemUrlRules } from './lineItemUrlPolicy.js';
import { policyResultScores } from './storedResultScores.js';

/** What a send needs. */
export interface GradeJobSendDeps {
  readonly db: Database;
  readonly encryption: Pick<DataEncryption, 'decrypt'>;
  readonly sender: AgsScoreSender;
  /** `CANVAS_ORIGINS` and production's https rule; without them only the platform's own origins are allowed. */
  readonly lineItemRules?: LineItemUrlRules;
  /** The wall clock in milliseconds, for each score's `timestamp`; defaults to `Date.now`. */
  readonly wallClock?: () => number;
}

const failed = (reason: string): AgsSendOutcome => ({ kind: 'failed', reason });

/** The learner's `sub`, decrypted, or the failure that stops the send. */
function subjectOf(
  deps: GradeJobSendDeps,
  group: readonly ClaimedGradeJob[],
): { readonly userId: string } | AgsSendOutcome {
  // WHY: the newest result's `sub`; a learner's `sub` is the same on every job of one placement.
  const withSub = [...group].reverse().find((job) => job.ltiSubEncrypted !== null);
  if (!withSub?.ltiSubEncrypted) return failed('no-subject');
  try {
    return {
      userId: deps.encryption.decrypt('grade-lti-sub', Buffer.from(withSub.ltiSubEncrypted)).toString('utf8'),
    };
  } catch {
    // WHY: a key removed from DATA_ENCRYPTION_KEYS will not come back; retrying cannot help.
    return failed('subject-unreadable');
  }
}

/**
 * Sends one learner's policy score for one placement.
 * @param deps - Database, encryption, sender, the line item rules and the wall clock.
 * @param group - The learner's claimed jobs in the placement (one, unless rows from before D-104's amendment remain).
 * @param now - The run's moment.
 * @returns What came of it; a failure before any request names its reason.
 * @spec LTI-012
 */
export async function sendLearnerScore(
  deps: GradeJobSendDeps,
  group: readonly ClaimedGradeJob[],
  now: Date,
): Promise<AgsSendOutcome> {
  const [first] = group;
  if (first === undefined) throw new RangeError('a group has at least one job');
  const placement = await deps.db.ltiPlacement.findUnique({
    where: { id: first.placementId },
    select: {
      platformId: true,
      contextId: true,
      contentId: true,
      lineItemUrl: true,
      attemptPolicy: true,
      masteryThreshold: true,
      platform: { select: { url: true, authenticationEndpoint: true, accessTokenEndpoint: true } },
    },
  });
  if (!placement?.lineItemUrl) return failed('no-line-item');
  // SECURITY: checked again before any token is asked for: a URL stored before the rule, or CANVAS_ORIGINS changed.
  if (lineItemUrlRefusal(placement.lineItemUrl, placement.platform, deps.lineItemRules) !== undefined) {
    return failed('line-item-url');
  }
  const subject = subjectOf(deps, group);
  if ('kind' in subject) return subject;
  const results = await policyResultScores(deps.db, placement, first.learnerKey);
  if (results.length === 0) return failed('no-result');
  // WHY: D-104's "time of sending". Canvas refuses (400) a score older than the one it holds, so the run's moment,
  // which a long run leaves behind, could make this send lose to a later-started run on another node that sent first.
  const sentAt = Math.max(now.getTime(), (deps.wallClock ?? Date.now)());
  return deps.sender.postScore({
    platformId: placement.platformId,
    lineItemUrl: placement.lineItemUrl,
    userId: subject.userId,
    scoreGiven: policyScore(placement, results),
    timestamp: new Date(sentAt),
  });
}
