/**
 * Tests for V-IMG-ALT-LENGTH (imageAltLengthRule): alt texts over 250 characters belong in the text. Each fixture in apps/server/test/fixtures/content/V-IMG-ALT-LENGTH/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { imageAltLengthRule } from '../../../src/validation/rules/imageAltLengthRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-IMG-ALT-LENGTH', () => {
  it.each(fixturesOf('V-IMG-ALT-LENGTH'))('[UD-021][V-IMG-ALT-LENGTH] $name: $description', (fixture) => {
    expect(hitsOf(imageAltLengthRule, fixture)).toEqual(fixture.expected);
  });
});
