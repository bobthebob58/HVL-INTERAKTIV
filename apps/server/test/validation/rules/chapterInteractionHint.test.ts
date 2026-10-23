/**
 * Tests for PED-H10 (chapterInteractionHint): add a check to long chapters. Each fixture in apps/server/test/fixtures/content/PED-H10/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { chapterInteractionHint } from '../../../src/validation/rules/chapterInteractionHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H10', () => {
  it.each(fixturesOf('PED-H10'))('[PED-020][PED-H10] $name: $description', (fixture) => {
    expect(hitsOf(chapterInteractionHint, fixture)).toEqual(fixture.expected);
  });
});
