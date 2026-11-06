/**
 * activityResults — where the pedagogisk mappe gets learner results from (`ActivityResultsSource`) and the aggregates
 * an export may show, with the minimum group size applied.
 *
 * Why: MAPPE-002 shows per activity the participants, the completion rate, the median attempts and the change from
 *      first to last attempt, as anonymised aggregates (MAPPE-003). From S6 the source reads the stored learning data
 *      (./storedActivityResults.ts, D-095); S5's source, which had none, is gone, and this module turns whatever a
 *      source hands over into the figures an export may show. The mappe adds up groups that insight shows one at a
 *      time (D-106), so its totals must not let a value insight hides be worked out (INS-006).
 * Spec: MAPPE-003, MAPPE-002, INS-006
 * Invariants:
 *   - PRIVACY: a source hands over one summary per learner and group (course, version, semester) with only attempts,
 *     completion, two scaled scores and the group's number; it carries no learner identifier and no answer text.
 *     Only aggregates leave this module, never a summary, and each aggregate passes ../../privacy/minimumGroupSize.ts:
 *     the participants, the median attempts and the change are hidden below *k*, the completion rate with
 *     complementary suppression (DATA-*: pseudonymised data only), so a rate of 0 % or 100 % is never shown (D-095's
 *     two-sided rule).
 *   - PRIVACY: insight hides a group's completers when they are 1 to *k* − 1. When any group's are, the completion
 *     rate and the median attempts are shown only if those groups' completers and non-completers together number at
 *     least *k* each; otherwise the mappe's total less insight's shown groups would give the hidden count.
 *   - What a summary means is D-115's, as in insight: a participant started (stored any statement), completed when
 *     they have a stored root result, and their attempts are their stored root results. The median attempts are
 *     those of the learners with at least one, hidden when fewer than *k* have one.
 *   - The change is the mean of (last − first) in percentage points over the learners with both scores (two or more
 *     scored results), hidden when fewer than *k* learners have both.
 * Collaborators: ./MappeRenderer.ts, ./mappeActivityView.ts, ./storedActivityResults.ts (the source),
 *   ../../privacy/minimumGroupSize.ts, ../../insight/suppression/insightCells.ts (`isShowableCount`).
 * Tests: apps/server/test/learningDesign/mappe/activityResults.test.ts
 */
import { isShowableCount } from '../../insight/suppression/insightCells.js';
import {
  visibleCompletionRate,
  visibleCount,
  type MinimumGroupSize,
} from '../../privacy/minimumGroupSize.js';

/** What a source knows about one learner's work on one activity in one group; no identifier, no answer text. */
export interface LearnerAttemptSummary {
  /** The group (course, version and semester) as a number from 0 within the activity, meaningless outside a read. */
  readonly group: number;
  /** The learner's attempts: their stored root results (D-115); 0 for a learner who started without one. */
  readonly attempts: number;
  /** Whether the learner has a stored root result (D-115's "completed"). */
  readonly completed: boolean;
  /** The scaled score (0–1) of the first scored result, or null unless the learner has two or more. */
  readonly firstScore: number | null;
  /** The scaled score (0–1) of the last scored result, or null unless the learner has two or more. */
  readonly lastScore: number | null;
}

/** Where learner results come from (D-095): the stored learning data from S6 (./storedActivityResults.ts). */
export interface ActivityResultsSource {
  /**
   * The learners' summaries per activity.
   * @param contentIds - The activities; the caller has checked that the author may see each one (D-066).
   * @param size - The minimum group size the export applies, which a source also applies to its groups.
   * @returns A map from activity to one summary per learner and group, from groups of at least *k* learners only
   *   (an activity missing from it had none), or undefined when the source has no results at all, which the export
   *   then says.
   */
  learnerSummaries(
    contentIds: readonly string[],
    size: MinimumGroupSize,
  ): Promise<ReadonlyMap<string, readonly LearnerAttemptSummary[]> | undefined>;
}

/** The aggregates of one activity as an export may show them; undefined means hidden or not known. */
export interface ActivityAggregates {
  /** False when the source had no results at all. */
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
 * Whether the completers insight hides may go into the mappe's totals.
 * @param size - The minimum group size.
 * @param learners - The summaries of one activity.
 * @returns True when no group's completers are hidden in insight, or when the groups whose are have, together, at
 *   least *k* completers and *k* non-completers.
 */
function hiddenCompletersAddUp(size: MinimumGroupSize, learners: readonly LearnerAttemptSummary[]): boolean {
  const groups = new Map<number, { learners: number; completed: number }>();
  for (const { group, completed } of learners) {
    const known = groups.get(group) ?? { learners: 0, completed: 0 };
    groups.set(group, { learners: known.learners + 1, completed: known.completed + (completed ? 1 : 0) });
  }
  // PRIVACY: insight shows a group's completers only as 0 or at least k (INS-006); the mappe's total less the shown
  // groups must not give the others' count, so those others must pass the two-sided rule together.
  const hidden = [...groups.values()].filter(({ completed }) => !isShowableCount(size, completed));
  if (hidden.length === 0) return true;
  const total = (pick: (group: { learners: number; completed: number }) => number) =>
    hidden.reduce((sum, group) => sum + pick(group), 0);
  return (
    visibleCompletionRate(
      size,
      total((group) => group.completed),
      total((group) => group.learners),
    ) !== undefined
  );
}

/**
 * The aggregates of one activity's learners.
 * @param size - The minimum group size.
 * @param learners - The learners' summaries, or undefined when the source has no results at all.
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
  const addsUp = hiddenCompletersAddUp(size, learners);
  const completed = learners.filter((learner) => learner.completed).length;
  const completionRate = addsUp ? visibleCompletionRate(size, completed, learners.length) : undefined;
  // WHY: a learner with no root result has no attempt to count (D-115); insight's median attempts read the same.
  const attempts = learners.flatMap(({ attempts: count }) => (count > 0 ? [count] : []));
  const medianAttempts =
    !addsUp || visibleCount(size, attempts.length) === undefined ? undefined : median(attempts);
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
    ...(medianAttempts === undefined ? {} : { medianAttempts }),
    ...(changePoints === undefined ? {} : { changePoints }),
  };
}
