/**
 * gradeRetrySchedule — what a grade job becomes after one send: succeeded, orphaned, failed, or pending again at a
 * later time chosen by exponential backoff with jitter, `Retry-After` and D-104's limits.
 *
 * Why: D-104 retries a 429, a 5xx or a network error "with exponential backoff and jitter, at most 8 attempts, the
 *      last within 24 h of the first; then the job is `failed`". A platform's `Retry-After` is honoured as the least
 *      delay. Keeping the schedule pure lets a test check every boundary without a clock or a database.
 * Spec: LTI-012
 * Invariants:
 *   - The delay after the n-th failed attempt is 1 minute × 3^(n−1), times a jitter factor in [0.8, 1.2), or the
 *     `Retry-After` delay when that is longer. With jitter the seven delays add up to under 22 hours.
 *   - No ninth attempt: after the 8th the job fails. No attempt later than 24 hours after the job was created, which
 *     is no later than its first attempt (the worker claims a new job at its next tick): a retry that would fall later
 *     fails the job now. A job requeued after its 24 hours (an author's retry) therefore gets one attempt each time.
 *   - Every settlement but `retry` is final for the worker; `retry` keeps the job `pending` (D-104).
 * Collaborators: ./agsSendOutcome.ts, ./gradeJobClaims.ts (writes the settlement), ./gradeSyncRun.ts.
 * Tests: apps/server/test/grades/gradeRetrySchedule.test.ts, apps/server/test/grades/gradeSyncWindow.int.test.ts
 */
import type { AgsSendOutcome } from './agsSendOutcome.js';

/** At most this many sends per job (LTI-012, D-104). */
export const MAX_SEND_ATTEMPTS = 8;
/** Every attempt falls within this time of the job's creation (LTI-012, D-104). */
export const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The delay after the first failed attempt. */
export const FIRST_RETRY_DELAY_MS = 60 * 1000;
/** How much each delay grows over the one before. */
export const RETRY_GROWTH = 3;
/** The jitter: each delay is multiplied by a factor in [1 − this, 1 + this). */
export const RETRY_JITTER = 0.2;

/** What a job becomes after a send. */
export type GradeJobSettlement =
  | { readonly kind: 'succeeded' }
  | { readonly kind: 'orphaned' }
  | { readonly kind: 'failed'; readonly reason: string }
  | { readonly kind: 'retry'; readonly reason: string; readonly nextAttemptAt: Date };

/** What the schedule needs to know about a job. */
export interface RetryFacts {
  /** Sends made before this one (`GradeSyncJob.attempts`). */
  readonly attempts: number;
  /** When the job was created; the 24 hours run from here. */
  readonly createdAt: Date;
}

/**
 * The backoff delay after a failed attempt, before `Retry-After` is considered.
 * @param attemptsMade - Sends made so far, including the one that just failed (1 or more).
 * @param random - A number in [0, 1), for the jitter.
 * @returns The delay in milliseconds.
 */
export function retryDelayMs(attemptsMade: number, random: number): number {
  const jitter = 1 - RETRY_JITTER + 2 * RETRY_JITTER * random;
  return Math.round(FIRST_RETRY_DELAY_MS * RETRY_GROWTH ** Math.max(0, attemptsMade - 1) * jitter);
}

/**
 * When a job that just failed in a way worth retrying is tried again, if at all.
 * @param job - Its attempts before this send and its creation time.
 * @param now - The moment of this send.
 * @param retryAfterMs - The platform's `Retry-After`, if it gave one.
 * @param random - A number in [0, 1), for the jitter.
 * @returns The next attempt's time, or undefined when the job has used its 8 attempts or its 24 hours.
 * @spec LTI-012
 */
export function nextRetryAt(
  job: RetryFacts,
  now: Date,
  retryAfterMs: number | undefined,
  random: number,
): Date | undefined {
  const attemptsMade = job.attempts + 1;
  if (attemptsMade >= MAX_SEND_ATTEMPTS) return undefined;
  const delay = Math.max(retryDelayMs(attemptsMade, random), retryAfterMs ?? 0);
  const at = now.getTime() + delay;
  return at > job.createdAt.getTime() + RETRY_WINDOW_MS ? undefined : new Date(at);
}

/**
 * What one job becomes after a send of its learner's score.
 * @param job - Its attempts before this send and its creation time.
 * @param outcome - How the send ended.
 * @param now - The moment of the send.
 * @param random - A number in [0, 1), for the jitter.
 * @returns The settlement to write.
 * @spec LTI-012
 */
export function settlementFor(
  job: RetryFacts,
  outcome: AgsSendOutcome,
  now: Date,
  random: number,
): GradeJobSettlement {
  switch (outcome.kind) {
    case 'sent':
      return { kind: 'succeeded' };
    case 'orphaned':
      return { kind: 'orphaned' };
    case 'failed':
      return { kind: 'failed', reason: outcome.reason };
    case 'retry': {
      const next = nextRetryAt(job, now, outcome.retryAfterMs, random);
      return next
        ? { kind: 'retry', reason: outcome.reason, nextAttemptAt: next }
        : { kind: 'failed', reason: outcome.reason };
    }
  }
}
