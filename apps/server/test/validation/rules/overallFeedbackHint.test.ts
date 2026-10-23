/**
 * Tests for PED-H11 (overallFeedbackHint): say why in overall feedback. Each fixture in apps/server/test/fixtures/content/PED-H11/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { isBareVerdict } from '../../../src/validation/feedbackText.js';
import { overallFeedbackHint } from '../../../src/validation/rules/overallFeedbackHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H11', () => {
  it.each(fixturesOf('PED-H11'))('[PED-020][PED-H11] $name: $description', (fixture) => {
    expect(hitsOf(overallFeedbackHint, fixture)).toEqual(fixture.expected);
  });

  it.each([
    ['Feil!', true],
    ['<p>Riktig!</p>', true],
    ['Correct, well done!', true],
    ['Du fekk @score av @total poeng.', true],
    ['Prøv igjen.', true],
    ['Rett. Du ser at tilbakemelding hjelper studentane vidare.', false],
    ['Bra! Du kjenner skilnaden mellom undervegs- og sluttvurdering.', false],
    ['', false],
  ])('[PED-020][PED-H11] treats «%s» as a bare verdict: %s', (feedback, verdict) => {
    expect(isBareVerdict(feedback)).toBe(verdict);
  });
});
