/**
 * Tests for V-LINK-TEXT (linkTextRule): links must say where they lead. Each fixture in apps/server/test/fixtures/content/V-LINK-TEXT/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { linkTextRule, linkTextProblem } from '../../../src/validation/rules/linkTextRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-LINK-TEXT', () => {
  it.each(fixturesOf('V-LINK-TEXT'))('[UD-021][V-LINK-TEXT] $name: $description', (fixture) => {
    expect(hitsOf(linkTextRule, fixture)).toEqual(fixture.expected);
  });

  it.each([
    ['klikk her', 'vague'],
    ['Klikk her!', 'vague'],
    ['her', 'vague'],
    ['les meir …', 'vague'],
    ['Click here', 'vague'],
    ['https://www.hvl.no/studier/', 'bareUrl'],
    ['www.hvl.no', 'bareUrl'],
    ['', 'bareUrl'],
    ['Emneplanen for MGL5', undefined],
    ['Les meir om universell utforming', undefined],
  ])('[UD-021][V-LINK-TEXT] judges «%s» as %s', (text, problem) => {
    expect(linkTextProblem(text)).toBe(problem);
  });
});
