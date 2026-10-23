/**
 * Tests for V-BRANCH-COLOUR (branchColourRule): choices need text, not only a colour. Each fixture in apps/server/test/fixtures/content/V-BRANCH-COLOUR/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { isColourOnlyChoice } from '../../../src/validation/colourWords.js';
import { colourWordsRule } from '../../../src/validation/rules/colourWordsRule.js';
import { branchColourRule } from '../../../src/validation/rules/branchColourRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-BRANCH-COLOUR', () => {
  it.each(fixturesOf('V-BRANCH-COLOUR'))('[UD-021][V-BRANCH-COLOUR] $name: $description', (fixture) => {
    expect(hitsOf(branchColourRule, fixture)).toEqual(fixture.expected);
  });

  it.each([
    ['Raud', true],
    ['Den grøne', true],
    ['🔴', true],
    ['\u2764\uFE0F', true],
    ['The green one', true],
    ['Vel den blå knappen', true],
    ['Eg vel den raude boka fordi ho er kortast.', false],
    ['Lag ein quiz', false],
    ['', false],
  ])('[UD-021][V-BRANCH-COLOUR] treats «%s» as colour only: %s', (text, colourOnly) => {
    expect(isColourOnlyChoice(text)).toBe(colourOnly);
  });

  it('[UD-021][V-BRANCH-COLOUR] leaves colour-only choices to V-BRANCH-COLOUR, so V-COLOUR-WORDS does not repeat them', () => {
    // Arrange
    const [fixture] = fixturesOf('V-BRANCH-COLOUR').filter((f) => f.name.startsWith('positive-'));
    // Act and assert
    expect(fixture && hitsOf(colourWordsRule, fixture)).toEqual([]);
  });
});
