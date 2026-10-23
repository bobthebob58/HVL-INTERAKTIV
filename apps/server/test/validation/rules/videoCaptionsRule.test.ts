/**
 * Tests for V-VID-CAPTIONS (videoCaptionsRule): videos need captions. Each fixture in apps/server/test/fixtures/content/V-VID-CAPTIONS/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { videoCaptionsRule } from '../../../src/validation/rules/videoCaptionsRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-VID-CAPTIONS', () => {
  it.each(fixturesOf('V-VID-CAPTIONS'))('[UD-021][V-VID-CAPTIONS] $name: $description', (fixture) => {
    expect(hitsOf(videoCaptionsRule, fixture)).toEqual(fixture.expected);
  });
});
