/**
 * Tests for PED-H05 (wrongOptionFeedbackHint): explain why a wrong option is wrong. Each fixture in apps/server/test/fixtures/content/PED-H05/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { wrongOptionFeedbackHint } from '../../../src/validation/rules/wrongOptionFeedbackHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H05', () => {
  it.each(fixturesOf('PED-H05'))('[PED-020][PED-H05] $name: $description', (fixture) => {
    expect(hitsOf(wrongOptionFeedbackHint, fixture)).toEqual(fixture.expected);
  });
});
