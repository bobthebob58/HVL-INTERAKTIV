/**
 * Tests for V-HEADING-ORDER (headingOrderRule): headings must not skip levels. Each fixture in apps/server/test/fixtures/content/V-HEADING-ORDER/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { headingOrderRule, firstSkip } from '../../../src/validation/rules/headingOrderRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-HEADING-ORDER', () => {
  it.each(fixturesOf('V-HEADING-ORDER'))('[UD-021][V-HEADING-ORDER] $name: $description', (fixture) => {
    expect(hitsOf(headingOrderRule, fixture)).toEqual(fixture.expected);
  });

  it.each([
    [[2, 4], { from: 2, to: 4 }],
    [[2, 3, 5], { from: 3, to: 5 }],
    [[3, 2, 4], { from: 2, to: 4 }],
    [[2, 3, 4, 2, 3], undefined],
    [[4], undefined],
    [[], undefined],
  ])('[UD-021][V-HEADING-ORDER] finds the first skip in %j', (levels, skip) => {
    expect(firstSkip(levels)).toEqual(skip);
  });
});
