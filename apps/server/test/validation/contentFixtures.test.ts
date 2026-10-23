/**
 * Tests that every rule has positive and negative content fixtures, that the fixture README describes each one, and
 * that each fixture gives the same result through the whole validator as through its rule.
 *
 * Spec: UD-020, UD-021, PED-020
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/validation/ruleSet.js';
import { validateContent } from '../../src/validation/validateContent.js';
import { contextOf, fixtureRuleIds, fixturesOf, FIXTURES_DIR, inputOf } from './support/ruleFixtures.js';

const allFixtures = RULES.flatMap((rule) => fixturesOf(rule.id).map((fixture) => ({ rule, fixture })));

describe('[UD-021] content fixtures', () => {
  it('[UD-021] has a fixture folder for every rule and no folder without a rule', () => {
    expect(fixtureRuleIds()).toEqual(RULES.map((rule) => rule.id).sort());
  });

  it.each(RULES.map((rule) => [rule.id, rule.requirement]))(
    '[UD-021] %s has positive and negative fixtures (%s)',
    (ruleId) => {
      // Arrange
      const fixtures = fixturesOf(ruleId);
      const positive = fixtures.filter((f) => f.name.startsWith('positive-'));
      const negative = fixtures.filter((f) => f.name.startsWith('negative-'));
      // Act and assert
      expect(positive.length).toBeGreaterThan(0);
      expect(negative.length).toBeGreaterThan(0);
      expect(positive.length + negative.length).toBe(fixtures.length);
      for (const f of positive) expect(f.expected.length).toBeGreaterThan(0);
      for (const f of negative) expect(f.expected).toEqual([]);
    },
  );

  it('[UD-021] describes every fixture file in the fixture README', () => {
    const readme = readFileSync(join(FIXTURES_DIR, 'README.md'), 'utf8');
    const missing = allFixtures.map(({ rule, fixture }) => `${rule.id}/${fixture.name}.json`);
    expect(missing.filter((path) => !readme.includes(`\`${path}\``))).toEqual([]);
  });

  it.each(allFixtures.map(({ rule, fixture }) => [rule.id, fixture.name, rule, fixture] as const))(
    '[UD-020] %s/%s gives the expected findings through validateContent, with messages in nn, nb and en',
    (ruleId, _, rule, fixture) => {
      for (const locale of ['nn', 'nb', 'en'] as const) {
        // Act
        const findings = validateContent(inputOf(fixture, locale), contextOf(fixture)).filter(
          (finding) => finding.ruleId === ruleId,
        );
        // Assert
        expect(findings.map((f) => f.path).sort()).toEqual(fixture.expected.map((e) => e.path).sort());
        for (const finding of findings) {
          expect(finding).toMatchObject({ severity: rule.severity, requirement: rule.requirement });
          expect(finding.message).not.toMatch(/^(?:V|PED)-|\{\{/);
        }
      }
    },
  );
});
