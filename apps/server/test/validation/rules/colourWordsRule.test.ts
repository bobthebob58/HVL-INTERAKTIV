/**
 * Tests for V-COLOUR-WORDS (colourWordsRule): do not refer to things by colour alone. Each fixture in apps/server/test/fixtures/content/V-COLOUR-WORDS/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { findColourPhrase } from '../../../src/validation/colourWords.js';
import { colourWordsRule } from '../../../src/validation/rules/colourWordsRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-COLOUR-WORDS', () => {
  it.each(fixturesOf('V-COLOUR-WORDS'))('[UD-021][V-COLOUR-WORDS] $name: $description', (fixture) => {
    expect(hitsOf(colourWordsRule, fixture)).toEqual(fixture.expected);
  });

  it('[UD-021][V-COLOUR-WORDS] leaves branching choices that are only a colour to V-BRANCH-COLOUR', () => {
    // Arrange
    const [colourOnlyChoices] = fixturesOf('V-BRANCH-COLOUR').filter((f) => f.name.startsWith('positive-'));
    // Act and assert
    expect(colourOnlyChoices && hitsOf(colourWordsRule, colourOnlyChoices)).toEqual([]);
  });

  it.each([
    ['Klikk på det raude feltet.', 'raude feltet'],
    ['Vel den grøne knappen', 'grøne knappen'],
    ['Dei blå orda er verb.', 'blå orda'],
    ['Svaret er markert i raudt.', 'i raudt'],
    ['Choose the green option', 'green option'],
    ['Words in red are wrong', 'in red'],
  ])('[UD-021][V-COLOUR-WORDS] finds a colour phrase in «%s»', (text, phrase) => {
    expect(findColourPhrase(text)).toBe(phrase);
  });

  it.each([
    'Kva farge har himmelen? Blå.',
    'Du har svart rett.',
    'Den raude tråden i emnet er vurdering.',
    'Greenwich',
  ])('[UD-021][V-COLOUR-WORDS] finds no colour phrase in «%s»', (text) => {
    expect(findColourPhrase(text)).toBeUndefined();
  });
});
