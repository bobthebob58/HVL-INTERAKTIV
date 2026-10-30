/**
 * Tests for the catalogue's pure filter rules: a pattern matches the chosen phase, content type and build-time limit
 * together; the type filter offers the types the catalogue holds in the ten types' order; the build-time filter
 * offers its fixed limits plus one from the address.
 *
 * Spec: PED-003
 */
import { describe, expect, it } from 'vitest';
import {
  buildTimeChoices,
  contentTypeChoices,
  matchingPatterns,
} from '../../src/features/studio/catalogue/catalogueFilter';
import { OVERVIEW } from '../support/studioFixtures';

const ids = (filters: Parameters<typeof matchingPatterns>[1]) =>
  matchingPatterns(OVERVIEW.patterns, filters).map((pattern) => pattern.id);

describe('[PED-003] the catalogue filter rules', () => {
  it.each([
    [{}, ['fixture-video', 'fixture-case', 'fixture-terms', 'fixture-quiz']],
    [{ phase: 'etterarbeid' }, ['fixture-terms', 'fixture-quiz']],
    [{ type: 'H5P.Blanks' }, ['fixture-terms']],
    [{ buildTime: 30 }, ['fixture-video', 'fixture-terms']],
    [{ phase: 'forarbeid', buildTime: 45 }, ['fixture-video', 'fixture-quiz']],
    [{ phase: 'underveis', type: 'H5P.QuestionSet' }, []],
  ] as const)('[PED-003] the filters %j match %j', (filters, expected) => {
    expect(ids(filters)).toEqual(expected);
  });

  it('[PED-003] offers the catalogue’s content types in the ten types’ order, plus the address’s own', () => {
    expect(contentTypeChoices(OVERVIEW.patterns, {})).toEqual([
      'H5P.InteractiveVideo',
      'H5P.QuestionSet',
      'H5P.DragText',
      'H5P.Blanks',
      'H5P.BranchingScenario',
    ]);
    expect(contentTypeChoices(OVERVIEW.patterns, { type: 'H5P.Column' })).toContain('H5P.Column');
  });

  it('[PED-003] offers fixed build-time limits, plus the address’s own, in increasing order', () => {
    expect(buildTimeChoices({})).toEqual([15, 30, 60, 120]);
    expect(buildTimeChoices({ buildTime: 90 })).toEqual([15, 30, 60, 90, 120]);
  });
});
