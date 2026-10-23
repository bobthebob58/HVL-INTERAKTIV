/**
 * Tests for V-LANG (languageRule): the activity needs a language. Each fixture in apps/server/test/fixtures/content/V-LANG/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { languageRule } from '../../../src/validation/rules/languageRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-LANG', () => {
  it.each(fixturesOf('V-LANG'))('[UD-021][V-LANG] $name: $description', (fixture) => {
    expect(hitsOf(languageRule, fixture)).toEqual(fixture.expected);
  });
});
