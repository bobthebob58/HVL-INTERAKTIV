/**
 * Unit tests for the attempt policies of LTI-012: best, latest and mastery, the order of attempts (resultAt, then
 * the attempt number, never the order passed in), the default threshold, and the 0–100 range. fast-check is not yet
 * a direct dependency (D-114 adds it), so the order-independence is checked over every permutation of a small set.
 *
 * Spec: LTI-012
 */
import { describe, expect, it } from 'vitest';
import {
  attemptNumberOf,
  compareResultOrder,
  policyScore,
  type AttemptScore,
} from '../../src/grades/attemptPolicyScore.js';

const at = (minute: number): Date => new Date(Date.UTC(2026, 9, 30, 10, minute));
const attempt = (attemptId: string, scoreGiven: number, minute: number): AttemptScore => ({
  attemptId,
  scoreGiven,
  resultAt: at(minute),
});
const VIEW = '0b0e4a8e-4f8c-4f6e-9d0a-6f1d1c2b3a4e';

/** Every order of a list. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

describe('[LTI-012] attempt policies', () => {
  const attempts = [attempt(`${VIEW}:1`, 40, 1), attempt(`${VIEW}:2`, 90, 2), attempt(`${VIEW}:3`, 60, 3)];

  it.each([
    ['best', null, 90],
    ['latest', null, 60],
    ['mastery', null, 100],
    ['mastery', 0.95, 60],
  ] as const)('[LTI-012] %s (threshold %s) sends %d', (attemptPolicy, masteryThreshold, expected) => {
    expect(policyScore({ attemptPolicy, masteryThreshold }, attempts)).toBe(expected);
  });

  it('[LTI-012] gives the same score in every order the attempts are passed', () => {
    // Arrange
    const policies = [
      { attemptPolicy: 'best', masteryThreshold: null },
      { attemptPolicy: 'latest', masteryThreshold: null },
      { attemptPolicy: 'mastery', masteryThreshold: 0.95 },
    ] as const;
    // Act
    const scores = policies.map(
      (setting) => new Set(permutations(attempts).map((p) => policyScore(setting, p))),
    );
    // Assert
    expect(scores.map((set) => [...set])).toEqual([[90], [60], [60]]);
  });

  it('[LTI-012] orders latest by result time, then by attempt number, never by the order of creation', () => {
    // Arrange: the second view's attempt came last; within one view at one moment, attempt 10 comes after 9
    const other = 'f3c1a1d2-1111-4222-8333-944455556666';
    const sameTime = [attempt(`${VIEW}:10`, 30, 5), attempt(`${VIEW}:9`, 80, 5)];
    const views = [attempt(`${other}:1`, 70, 7), attempt(`${VIEW}:4`, 20, 6)];
    // Act
    const latest = (list: AttemptScore[]) =>
      policyScore({ attemptPolicy: 'latest', masteryThreshold: null }, list);
    // Assert
    expect(latest(sameTime)).toBe(30);
    expect(latest(views)).toBe(70);
    expect(compareResultOrder(sameTime[1] as AttemptScore, sameTime[0] as AttemptScore)).toBeLessThan(0);
  });

  it('[LTI-012] counts a score of exactly the threshold as mastery, despite floating point', () => {
    // Arrange: 0.7 × 100 is 70.00000000000001 in JavaScript
    const setting = { attemptPolicy: 'mastery', masteryThreshold: 0.7 } as const;
    // Act and assert
    expect(policyScore(setting, [attempt(`${VIEW}:1`, 70, 1)])).toBe(100);
    expect(policyScore(setting, [attempt(`${VIEW}:1`, 69.99, 1)])).toBe(69.99);
  });

  it('[LTI-012] uses the default threshold 0.8 when the placement has none', () => {
    const setting = { attemptPolicy: 'mastery', masteryThreshold: null } as const;
    expect(policyScore(setting, [attempt(`${VIEW}:1`, 80, 1)])).toBe(100);
    expect(policyScore(setting, [attempt(`${VIEW}:1`, 79.99, 1)])).toBe(79.99);
  });

  it('[LTI-012] keeps the score within 0–100 at two decimals, and needs at least one attempt', () => {
    const best = { attemptPolicy: 'best', masteryThreshold: null } as const;
    expect(policyScore(best, [attempt(`${VIEW}:1`, 100.0000001, 1)])).toBe(100);
    expect(policyScore(best, [attempt(`${VIEW}:1`, 33.333333, 1)])).toBe(33.33);
    expect(() => policyScore(best, [])).toThrow(RangeError);
  });

  it.each([
    [`${VIEW}:12`, 12],
    [`${VIEW}:0`, 0],
    [`${VIEW}:x`, 0],
    ['no-colon', 0],
  ])('[LTI-012] reads the attempt number of %s as %d', (attemptId, n) => {
    expect(attemptNumberOf(attemptId)).toBe(n);
  });
});
