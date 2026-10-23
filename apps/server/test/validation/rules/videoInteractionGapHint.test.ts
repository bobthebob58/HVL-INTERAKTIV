/**
 * Tests for PED-H02 (videoInteractionGapHint): add a check every few minutes. Each fixture in apps/server/test/fixtures/content/PED-H02/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import {
  videoInteractionGapHint,
  longestGap,
} from '../../../src/validation/rules/videoInteractionGapHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H02', () => {
  it.each(fixturesOf('PED-H02'))('[PED-020][PED-H02] $name: $description', (fixture) => {
    expect(hitsOf(videoInteractionGapHint, fixture)).toEqual(fixture.expected);
  });

  it.each([
    [[60, 420], 430, 360],
    [[], 600, 600],
    [[120, 300, 480], 600, 180],
    [[300], 0, 300],
  ])(
    '[PED-020][PED-H02] finds the longest gap for tasks at %j with a known end of %d s',
    (tasks, end, gap) => {
      expect(longestGap(tasks, end)).toBe(gap);
    },
  );
});
