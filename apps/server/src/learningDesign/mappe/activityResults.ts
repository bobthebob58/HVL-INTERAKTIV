/**
 * activityResults — where the pedagogisk mappe gets learner results from (`ActivityResultsSource`), the S5 source
 * that has none yet, and the aggregates an export may show, with the minimum group size applied.
 *
 * Why: MAPPE-002 shows per activity the participants, the completion rate, the median attempts and the change from
 *      first to last attempt, as anonymised aggregates (MAPPE-003). No results are stored before S6 (setFinished is
 *      off and no xAPI is recorded, D-095), so the S5 source answers "no results yet" and the export says so; S6
 *      gives the real source the same shape.
 * Spec: MAPPE-003, MAPPE-002
 * Invariants:
 *   - PRIVACY: a source hands over one summary per learner with only attempts, completion and two scaled scores; it
 *     carries no learner identifier and no answer text. Only aggregates leave this module, never a summary, and
 *     each aggregate passes ../../privacy/minimumGroupSize.ts: the participants, the median attempts and the change
 *     are hidden below *k*, the completion rate with complementary suppression (DATA-*: pseudonymised data only).
 *   - The change is the mean of (last − first) in percentage points over the learners with both scores, hidden when
 *     fewer than *k* learners have both.
 * Collaborators: ./MappeRenderer.ts, ./mappeActivityView.ts, ../../privacy/minimumGroupSize.ts, S6's results store.
 * Tests: apps/server/test/learningDesign/mappe/activityResults.test.ts
 */
import {
  visibleCompletionRate,
  visibleCount,
  type MinimumGroupSize,
} from '../../privacy/minimumGroupSize.js';

/** What a source knows about one learner's work on one activity; no identifier, no answer text. */
export interface LearnerAttemptSummary {
  /** The learner's attempts, at least 1. */
  readonly attempts: number;
  /** Whether the learner completed the activity. */
  readonly completed: boolean;
  /** The scaled score (0–1) of the first scored attempt, or null without one. */
  readonly firstScore: number | null;
  /** The scaled score (0–1) of the last scored attempt, or null without one. */
  readonly lastScore: number | null;
}

/** Where learner results come from (D-095): none in S5, the stored results from S6. */
export interface ActivityResultsSource {
  /**
   * The learners' summaries per activity.
   * @param contentIds - The activities.
   * @returns A map from activity to its learners (an activity missing from it had none), or undefined while no
   *   results are recorded at all.
   */
  learnerSummaries(
    contentIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly LearnerAttemptSummary[]> | undefined>;
}

/**
 * The S5 source: no results are recorded before S6, so it always answers "no results yet".
 * @spec MAPPE-003
 */
export const NO_RESULTS_YET: ActivityResultsSource = Object.freeze({
  learnerSummaries: () => Promise.resolve(undefined),
});

/** The aggregates of one activity as an export may show them; undefined means hidden or not known. */
export interface ActivityAggregates {
  /** False while no results are recorded at all (S5). */
  readonly recorded: boolean;
  /** True when the group is smaller than *k*, so nothing about it is shown. */
  readonly suppressed: boolean;
  readonly participants?: number;
  /** Between 0 and 1. */
  readonly completionRate?: number;
  readonly medianAttempts?: number;
  /** Mean change from the first to the last scored attempt, in percentage points. */
  readonly changePoints?: number;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/**
 * The aggregates of one activity's learners.
 * @param size - The minimum group size.
 * @param learners - The learners' summaries, or undefined while no results are recorded.
 * @returns The aggregates; with fewer than *k* learners, only `suppressed: true`.
 * @spec MAPPE-003
 */
export function activityAggregates(
  size: MinimumGroupSize,
  learners: readonly LearnerAttemptSummary[] | undefined,
): ActivityAggregates {
  if (learners === undefined) return { recorded: false, suppressed: false };
  const participants = visibleCount(size, learners.length);
  // PRIVACY: below k nothing is computed for the export, so no figure about a small group can leak (MAPPE-003).
  if (participants === undefined) return { recorded: true, suppressed: true };
  const completed = learners.filter((learner) => learner.completed).length;
  const completionRate = visibleCompletionRate(size, completed, learners.length);
  const changes = learners.flatMap(({ firstScore, lastScore }) =>
    firstScore === null || lastScore === null ? [] : [(lastScore - firstScore) * 100],
  );
  const changePoints =
    visibleCount(size, changes.length) === undefined
      ? undefined
      : changes.reduce((sum, change) => sum + change, 0) / changes.length;
  return {
    recorded: true,
    suppressed: false,
    participants,
    ...(completionRate === undefined ? {} : { completionRate }),
    medianAttempts: median(learners.map((learner) => learner.attempts)),
    ...(changePoints === undefined ? {} : { changePoints }),
  };
}
