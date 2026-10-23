/**
 * Tests for PED-H09 (slideWordsHint): one concept per slide. Each fixture in apps/server/test/fixtures/content/PED-H09/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { slideWordsHint } from '../../../src/validation/rules/slideWordsHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H09', () => {
  it.each(fixturesOf('PED-H09'))('[PED-020][PED-H09] $name: $description', (fixture) => {
    expect(hitsOf(slideWordsHint, fixture)).toEqual(fixture.expected);
  });
});
