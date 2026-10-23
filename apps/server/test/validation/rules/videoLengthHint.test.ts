/**
 * Tests for PED-H01 (videoLengthHint): long videos should be split. Each fixture in apps/server/test/fixtures/content/PED-H01/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { videoLengthHint } from '../../../src/validation/rules/videoLengthHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H01', () => {
  it.each(fixturesOf('PED-H01'))('[PED-020][PED-H01] $name: $description', (fixture) => {
    expect(hitsOf(videoLengthHint, fixture)).toEqual(fixture.expected);
  });
});
