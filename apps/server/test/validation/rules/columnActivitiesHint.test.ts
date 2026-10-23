/**
 * Tests for PED-H08 (columnActivitiesHint): split long columns. Each fixture in apps/server/test/fixtures/content/PED-H08/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { columnActivitiesHint } from '../../../src/validation/rules/columnActivitiesHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H08', () => {
  it.each(fixturesOf('PED-H08'))('[PED-020][PED-H08] $name: $description', (fixture) => {
    expect(hitsOf(columnActivitiesHint, fixture)).toEqual(fixture.expected);
  });
});
