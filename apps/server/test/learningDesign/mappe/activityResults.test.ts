/**
 * Tests for the pedagogisk mappe's aggregates (D-095): with fewer than *k* learners nothing is shown; the completion
 * rate is hidden when the completers or the non-completers number fewer than *k*, so 0 % and 100 % never show; the
 * median attempts count the learners with an attempt and need *k* of them; the change is hidden when fewer than *k*
 * learners have two scores; the rate and the median attempts are hidden when the total, less the groups insight
 * shows, would give a group's completers that insight hides; and a source with no results at all is said to have none.
 *
 * Spec: MAPPE-003, INS-006
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { countCell, shownValue } from '../../../src/insight/suppression/insightCells.js';
import {
  activityAggregates,
  type LearnerAttemptSummary,
} from '../../../src/learningDesign/mappe/activityResults.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';

const k5 = minimumGroupSize(5);
const learner = (overrides: Partial<LearnerAttemptSummary> = {}): LearnerAttemptSummary => ({
  group: 0,
  attempts: 2,
  completed: true,
  firstScore: 0.4,
  lastScore: 0.8,
  ...overrides,
});
const learners = (count: number, overrides: Partial<LearnerAttemptSummary> = {}) =>
  Array.from({ length: count }, () => learner(overrides));
const startedOnly = { attempts: 0, completed: false, firstScore: null, lastScore: null };
/** One group's summaries: `completed` of `size` learners completed once with no change, the others only started. */
const groupOf = (group: number, size: number, completed: number) =>
  Array.from({ length: size }, (_, n) =>
    learner(
      n < completed ? { group, attempts: 1, firstScore: null, lastScore: null } : { group, ...startedOnly },
    ),
  );

describe('[MAPPE-003] aggregates with the minimum group size', () => {
  it('[MAPPE-003] a 4-learner group shows nothing at all, not even the count', () => {
    expect(activityAggregates(k5, learners(4))).toEqual({ recorded: true, suppressed: true });
  });

  it('[MAPPE-003] hides the completion rate when the completers or the non-completers are fewer than k', () => {
    // Act
    const allCompleted = activityAggregates(k5, learners(6));
    const fewNonCompleters = activityAggregates(k5, [...learners(6), ...learners(4, startedOnly)]);
    const both = activityAggregates(k5, [...learners(5), ...learners(5, startedOnly)]);
    // Assert
    expect(allCompleted).toMatchObject({ participants: 6, suppressed: false });
    expect(allCompleted.completionRate).toBeUndefined();
    expect(fewNonCompleters.completionRate).toBeUndefined();
    expect(both.completionRate).toBe(0.5);
  });

  it('[MAPPE-003] never shows a rate of 0 % or 100 %, however large the group (the two-sided rule)', () => {
    // Act
    const nobody = activityAggregates(k5, learners(40, startedOnly));
    const everybody = activityAggregates(k5, learners(40));
    // Assert
    expect(nobody).toEqual({ recorded: true, suppressed: false, participants: 40 });
    expect(everybody.participants).toBe(40);
    expect(everybody.completionRate).toBeUndefined();
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

  it('[MAPPE-003] the median attempts count only the learners with an attempt, and need k of them', () => {
    // Arrange
    const fourWithAttempts = [...learners(4, { attempts: 3 }), ...learners(8, startedOnly)];
    const fiveWithAttempts = [
      ...[1, 1, 2, 3, 3].map((attempts) => learner({ attempts })),
      ...learners(9, startedOnly),
    ];
    // Act
    const hidden = activityAggregates(k5, fourWithAttempts);
    const shown = activityAggregates(k5, fiveWithAttempts);
    // Assert
    expect(hidden).toEqual({ recorded: true, suppressed: false, participants: 12 });
    expect(shown).toMatchObject({ participants: 14, medianAttempts: 2, changePoints: 40 });
  });

  it('[MAPPE-003] a source with no results at all is said to have none, with no figure', () => {
    expect(activityAggregates(k5, undefined)).toEqual({ recorded: false, suppressed: false });
  });
});

describe('[MAPPE-003] totals that insight’s views cannot difference', () => {
  it('[MAPPE-003] hides the rate and the median when the total less insight’s shown groups gives a hidden count', () => {
    // Arrange: insight shows version 2's 9 completers of 15, and version 1's 2 of 12 as «< 5».
    const twoVersions = [...groupOf(0, 12, 2), ...groupOf(1, 15, 9)];
    const hiddenTogetherK = [...groupOf(0, 10, 3), ...groupOf(1, 10, 4), ...groupOf(2, 20, 12)];
    const noneHidden = [...groupOf(0, 10, 0), ...groupOf(1, 10, 6)];
    // ...and here the two hidden groups' 8 completers would leave 2 non-completers: the two-sided rule applies.
    const fewHiddenNonCompleters = [...groupOf(0, 5, 4), ...groupOf(1, 5, 4), ...groupOf(2, 10, 5)];
    // Act
    const hidden = activityAggregates(k5, twoVersions);
    const addsUp = activityAggregates(k5, hiddenTogetherK);
    const zeroShown = activityAggregates(k5, noneHidden);
    const twoSided = activityAggregates(k5, fewHiddenNonCompleters);
    // Assert
    expect(hidden).toEqual({ recorded: true, suppressed: false, participants: 27 });
    expect(twoSided).toEqual({ recorded: true, suppressed: false, participants: 20 });
    expect(addsUp).toMatchObject({ participants: 40, completionRate: 19 / 40, medianAttempts: 1 });
    expect(zeroShown).toMatchObject({ participants: 20, completionRate: 0.3, medianAttempts: 1 });
  });

  it('[MAPPE-003] whatever the groups, a shown rate never lets a completer count insight hides be worked out', () => {
    const groupSizes = fc.array(
      fc
        .integer({ min: 5, max: 14 })
        .chain((size) => fc.tuple(fc.constant(size), fc.integer({ min: 0, max: size }))),
      { minLength: 1, maxLength: 4 },
    );
    fc.assert(
      fc.property(groupSizes, (groups) => {
        // Arrange
        const learners = groups.flatMap(([size, completed], group) => groupOf(group, size, completed));
        // Act
        const { participants, completionRate } = activityAggregates(k5, learners);
        // Assert: insight's own cells say which completer counts it hides (INS-006).
        if (completionRate === undefined || participants === undefined) return;
        const total = Math.round(completionRate * participants);
        const hiddenGroups = groups.filter(
          ([, completed]) => shownValue(countCell(k5, completed)) === undefined,
        );
        const shownSum = groups.reduce((sum, [, c]) => sum + (shownValue(countCell(k5, c)) ?? 0), 0);
        const hiddenLearners = hiddenGroups.reduce((sum, [size]) => sum + size, 0);
        if (hiddenGroups.length === 0) return;
        expect(total - shownSum).toBeGreaterThanOrEqual(k5.k);
        expect(hiddenLearners - (total - shownSum)).toBeGreaterThanOrEqual(k5.k);
      }),
    );
  });
});
