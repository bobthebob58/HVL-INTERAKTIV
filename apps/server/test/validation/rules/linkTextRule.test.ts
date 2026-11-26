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
    ['«Her»', 'vague'],
    ['(les meir).', 'vague'],
    ['→ lenke ←', 'vague'],
    ['…', 'bareUrl'],
    ['///', 'bareUrl'],
    ['!/', 'bareUrl'],
    ['her/', undefined],
    ['— Emneplanen for MGL5 —', undefined],
    ['2024', undefined],
    ['https://www.hvl.no/studier/ og meir', undefined],
  ])('[UD-021][V-LINK-TEXT] judges «%s» as %s', (text, problem) => {
    expect(linkTextProblem(text)).toBe(problem);
  });

  it('[UD-021][V-LINK-TEXT] a long text of punctuation between two words is judged in time that follows its length', () => {
    // Arrange: 50 000 characters that are neither letters nor digits, inside the text and after it
    const inside = `Emneplan${'!'.repeat(50_000)}for MGL5`;
    const after = `her${'.'.repeat(50_000)}`;
    // Act
    const started = performance.now();
    const problems = [linkTextProblem(inside), linkTextProblem(after)];
    const elapsed = performance.now() - started;
    // Assert
    expect(problems).toEqual([undefined, 'vague']);
    expect(elapsed).toBeLessThan(250);
  });
});
