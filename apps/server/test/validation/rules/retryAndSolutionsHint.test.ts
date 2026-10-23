/**
 * Tests for PED-H07 (retryAndSolutionsHint): keep retry and solutions on. Each fixture in apps/server/test/fixtures/content/PED-H07/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { retryAndSolutionsHint } from '../../../src/validation/rules/retryAndSolutionsHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H07', () => {
  it.each(fixturesOf('PED-H07'))('[PED-020][PED-H07] $name: $description', (fixture) => {
    expect(hitsOf(retryAndSolutionsHint, fixture)).toEqual(fixture.expected);
  });
});
