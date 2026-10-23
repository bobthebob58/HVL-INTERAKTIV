/**
 * Tests for V-TABLE-HEADERS (tableHeadersRule): tables need header cells. Each fixture in apps/server/test/fixtures/content/V-TABLE-HEADERS/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { tableHeadersRule } from '../../../src/validation/rules/tableHeadersRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-TABLE-HEADERS', () => {
  it.each(fixturesOf('V-TABLE-HEADERS'))('[UD-021][V-TABLE-HEADERS] $name: $description', (fixture) => {
    expect(hitsOf(tableHeadersRule, fixture)).toEqual(fixture.expected);
  });
});
