/**
 * Tests for the minimum group size (D-095): *k* is an integer of at least 3, a count below *k* is hidden, and the
 * completion rate is hidden on both sides (fewer than *k* completers or non-completers).
 *
 * Spec: MAPPE-003, INS-006
 */
import { describe, expect, it } from 'vitest';
import { minimumGroupSize, visibleCompletionRate, visibleCount } from '../../src/privacy/minimumGroupSize.js';

describe('[MAPPE-003] the minimum group size', () => {
  it.each([2, 0, -5, 4.5, Number.NaN])('[MAPPE-003] refuses k = %s: it is an integer of at least 3', (k) => {
    expect(() => minimumGroupSize(k)).toThrow(RangeError);
  });

  it('[MAPPE-003] hides a count below k and shows k itself', () => {
    // Arrange
    const size = minimumGroupSize(5);
    // Act and assert
    expect([4, 5, 30].map((count) => visibleCount(size, count))).toEqual([undefined, 5, 30]);
    expect(visibleCount(minimumGroupSize(3), 3)).toBe(3);
  });

  it('[MAPPE-003] hides the completion rate when either side is below k, so neither can be worked out', () => {
    // Arrange
    const size = minimumGroupSize(5);
    // Act and assert
    expect(visibleCompletionRate(size, 4, 20)).toBeUndefined();
    expect(visibleCompletionRate(size, 16, 20)).toBeUndefined();
    expect(visibleCompletionRate(size, 20, 20)).toBeUndefined();
    expect(visibleCompletionRate(size, 5, 10)).toBe(0.5);
  });
});
