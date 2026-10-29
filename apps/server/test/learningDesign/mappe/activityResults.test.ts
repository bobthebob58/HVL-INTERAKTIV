/**
 * Tests for the pedagogisk mappe's aggregates (D-095): with fewer than *k* learners nothing is shown; the completion
 * rate is hidden when the completers or the non-completers number fewer than *k*; the change is hidden when fewer
 * than *k* learners have two scores; the S5 source has no results at all.
 *
 * Spec: MAPPE-003, INS-006
 */
import { describe, expect, it } from 'vitest';
import {
  activityAggregates,
  NO_RESULTS_YET,
  type LearnerAttemptSummary,
} from '../../../src/learningDesign/mappe/activityResults.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';

const k5 = minimumGroupSize(5);
const learner = (overrides: Partial<LearnerAttemptSummary> = {}): LearnerAttemptSummary => ({
  attempts: 2,
  completed: true,
  firstScore: 0.4,
  lastScore: 0.8,
  ...overrides,
});
const learners = (count: number, overrides: Partial<LearnerAttemptSummary> = {}) =>
  Array.from({ length: count }, () => learner(overrides));

describe('[MAPPE-003] aggregates with the minimum group size', () => {
  it('[MAPPE-003] a 4-learner group shows nothing at all, not even the count', () => {
    expect(activityAggregates(k5, learners(4))).toEqual({ recorded: true, suppressed: true });
  });

  it('[MAPPE-003] hides the completion rate when the completers or the non-completers are fewer than k', () => {
    // Act
    const allCompleted = activityAggregates(k5, learners(6));
    const fewNonCompleters = activityAggregates(k5, [...learners(6), ...learners(4, { completed: false })]);
    const both = activityAggregates(k5, [...learners(5), ...learners(5, { completed: false })]);
    // Assert
    expect(allCompleted).toMatchObject({ participants: 6, suppressed: false });
    expect(allCompleted.completionRate).toBeUndefined();
    expect(fewNonCompleters.completionRate).toBeUndefined();
    expect(both.completionRate).toBe(0.5);
  });

  it('[MAPPE-003] gives the median attempts and the mean change in points only for groups of at least k', () => {
    // Arrange
    const group = [1, 2, 3, 4, 9].map((attempts) => learner({ attempts }));
    const fewScored = [...learners(3), ...learners(3, { firstScore: null, lastScore: null })];
    // Act
    const shown = activityAggregates(k5, group);
    const hiddenChange = activityAggregates(k5, fewScored);
    // Assert
    expect(shown).toMatchObject({ medianAttempts: 3, changePoints: 40 });
    expect(hiddenChange).toMatchObject({ participants: 6, medianAttempts: 2 });
    expect(hiddenChange.changePoints).toBeUndefined();
  });

  it('[MAPPE-003] the S5 source answers that no results are recorded yet', async () => {
    // Act
    const answer = await NO_RESULTS_YET.learnerSummaries(['0192f0c4-0000-7000-8000-000000000001']);
    // Assert
    expect(answer).toBeUndefined();
    expect(activityAggregates(k5, answer?.get('x'))).toEqual({ recorded: false, suppressed: false });
  });
});
