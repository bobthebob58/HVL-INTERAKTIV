/**
 * attemptPolicyScore — the one score a placement's attempt policy sends to Canvas, chosen from a learner's attempt
 * scores in that placement.
 *
 * Why: LTI-012's table: `best` sends the highest score so far, `latest` the latest, and `mastery` 100 once a score
 *      reaches the threshold (default 0.8), else the latest. D-104 applies the policy in the worker to the learner's
 *      job scores in the placement (an `XapiStatement` has no placement); D-115 makes each job one attempt with at
 *      most one gradable result, whose `scoreGiven` is `scaled × 100`.
 * Spec: LTI-012
 * Invariants:
 *   - Pure: the same attempts give the same score, in whatever order they are passed.
 *   - `latest` is the attempt whose result came last: by `resultAt` (the stored statement's timestamp, which keeps a
 *     batch's order, D-115), then by the attempt number `n` of `<viewId>:<n>`, then by `attemptId` as text, so equal
 *     times still give one answer.
 *   - `mastery` compares `scoreGiven` with `threshold × 100` with a tolerance of 1e-9, so a score of exactly the
 *     threshold counts despite floating point (0.7 × 100 is 70.00000000000001).
 *   - The result is within 0–100 and rounded to two decimals (`scaled` has four).
 * Collaborators: ./gradeSyncRun.ts (the caller), @hvl-interaktiv/api-contract (`AttemptPolicy`,
 *   `DEFAULT_MASTERY_THRESHOLD`).
 * Tests: apps/server/test/grades/attemptPolicyScore.test.ts
 */
import { DEFAULT_MASTERY_THRESHOLD, type AttemptPolicy } from '@hvl-interaktiv/api-contract';

/** One attempt's score, as its grade job holds it. */
export interface AttemptScore {
  /** `<viewId>:<n>` (D-115). */
  readonly attemptId: string;
  /** The attempt's `scaled × 100`. */
  readonly scoreGiven: number;
  /** When its result was stored. */
  readonly resultAt: Date;
}

/** A placement's policy setting (`LtiPlacement.attemptPolicy`, `masteryThreshold`). */
export interface AttemptPolicySetting {
  readonly attemptPolicy: AttemptPolicy;
  /** The scaled score that counts as mastery; null means the default, 0.8. */
  readonly masteryThreshold: number | null;
}

const FULL_MARKS = 100;
const TOLERANCE = 1e-9;

/**
 * The attempt number of an attempt ID.
 * @param attemptId - `<viewId>:<n>`.
 * @returns `n`, or 0 when the ID has no positive number after its last colon.
 */
export function attemptNumberOf(attemptId: string): number {
  const n = Number(attemptId.slice(attemptId.lastIndexOf(':') + 1));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/**
 * Orders attempts by when their results came: `resultAt`, then attempt number, then attempt ID.
 * @param a - One attempt.
 * @param b - Another.
 * @returns Negative when `a` came first, positive when `b` did, 0 for the same attempt.
 */
export function compareResultOrder(a: AttemptScore, b: AttemptScore): number {
  return (
    a.resultAt.getTime() - b.resultAt.getTime() ||
    attemptNumberOf(a.attemptId) - attemptNumberOf(b.attemptId) ||
    (a.attemptId < b.attemptId ? -1 : a.attemptId > b.attemptId ? 1 : 0)
  );
}

const clampAndRound = (score: number): number =>
  Math.round(Math.min(FULL_MARKS, Math.max(0, score)) * 100) / 100;

/**
 * The score the policy sends for a learner's attempts.
 * @param setting - The placement's policy and mastery threshold.
 * @param attempts - Every attempt of the learner in the placement; at least one.
 * @returns The score to send, 0–100.
 * @throws RangeError when there is no attempt (a programming error: a job always has one).
 * @spec LTI-012
 */
export function policyScore(setting: AttemptPolicySetting, attempts: readonly AttemptScore[]): number {
  const ordered = [...attempts].sort(compareResultOrder);
  const latest = ordered.at(-1);
  if (latest === undefined) throw new RangeError('an attempt policy needs at least one attempt');
  switch (setting.attemptPolicy) {
    case 'best':
      return clampAndRound(Math.max(...ordered.map((attempt) => attempt.scoreGiven)));
    case 'latest':
      return clampAndRound(latest.scoreGiven);
    case 'mastery': {
      const threshold = (setting.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD) * FULL_MARKS;
      const mastered = ordered.some((attempt) => attempt.scoreGiven + TOLERANCE >= threshold);
      return mastered ? FULL_MARKS : clampAndRound(latest.scoreGiven);
    }
  }
}
