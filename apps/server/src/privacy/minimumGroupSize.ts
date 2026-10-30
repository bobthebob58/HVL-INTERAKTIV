/**
 * minimumGroupSize — the minimum group size *k* for aggregates about learners, and the suppression rules that keep a
 * value about fewer than *k* learners out of every export.
 *
 * Why: MAPPE-003 applies INS-006's minimum group size to the pedagogisk mappe's aggregates (D-095): a teacher must
 *      never learn something about one learner from a count, a rate or a median. S6's insight views use this same
 *      module, so the rule is written once.
 * Spec: MAPPE-003, INS-006
 * Invariants:
 *   - PRIVACY: *k* is an integer of at least 3 (`MIN_GROUP_SIZE`, default 5); anything else throws, so a bad value can
 *     never lower the protection.
 *   - A count below *k* is suppressed (undefined), never rounded or shown as "fewer than".
 *   - The completion rate is suppressed when either the learners who completed or those who did not number fewer
 *     than *k*, so the hidden count cannot be worked out from the total and the other (complementary suppression).
 *     A rate of 0 % or 100 % is therefore always suppressed: it would say what every learner did.
 * Collaborators: ../config/env.ts (`MIN_GROUP_SIZE`), ../learningDesign/mappe/activityResults.ts (the mappe),
 *   S6's insight views.
 * Tests: apps/server/test/privacy/minimumGroupSize.test.ts
 */

/** The smallest *k* the rules accept (INS-006). */
export const SMALLEST_GROUP_SIZE = 3;

/** A checked minimum group size. */
export interface MinimumGroupSize {
  /** The number of learners a value must be about before it is shown. */
  readonly k: number;
}

/**
 * Checks a minimum group size.
 * @param k - The configured value, e.g. `env.MIN_GROUP_SIZE`.
 * @returns The checked size.
 * @throws RangeError when `k` is not an integer of at least 3.
 * @spec MAPPE-003
 */
export function minimumGroupSize(k: number): MinimumGroupSize {
  // PRIVACY: the environment schema already refuses such a value; refusing it here too means no caller can pass one.
  if (!Number.isInteger(k) || k < SMALLEST_GROUP_SIZE) {
    throw new RangeError(`the minimum group size must be an integer of at least ${SMALLEST_GROUP_SIZE}`);
  }
  return Object.freeze({ k });
}

/**
 * A count of learners as it may be shown.
 * @param size - The minimum group size.
 * @param count - How many learners.
 * @returns The count, or undefined when it is below *k*.
 * @spec MAPPE-003
 */
export function visibleCount(size: MinimumGroupSize, count: number): number | undefined {
  return count >= size.k ? count : undefined;
}

/**
 * A completion rate as it may be shown.
 * @param size - The minimum group size.
 * @param completed - Learners who completed.
 * @param total - All learners in the group.
 * @returns The rate between 0 and 1, or undefined when the completers or the non-completers number fewer than *k*.
 * @spec MAPPE-003
 */
export function visibleCompletionRate(
  size: MinimumGroupSize,
  completed: number,
  total: number,
): number | undefined {
  const notCompleted = total - completed;
  if (completed < size.k || notCompleted < size.k) return undefined;
  return completed / total;
}
