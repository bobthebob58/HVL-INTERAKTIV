/**
 * Tests for V-HOTSPOT-ORDER (hotspotOrderRule): hotspots need an order and a header. Each fixture in apps/server/test/fixtures/content/V-HOTSPOT-ORDER/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { hotspotOrderRule } from '../../../src/validation/rules/hotspotOrderRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-HOTSPOT-ORDER', () => {
  it.each(fixturesOf('V-HOTSPOT-ORDER'))('[UD-021][V-HOTSPOT-ORDER] $name: $description', (fixture) => {
    expect(hitsOf(hotspotOrderRule, fixture)).toEqual(fixture.expected);
  });
});
