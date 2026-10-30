/**
 * Unit tests for the choice a create-from-pattern request makes: the phase defaults to the pattern's first, a pattern
 * with two content types needs one named, and anything the pattern does not offer is 400 `hvl:pattern-choice-invalid`
 * (D-085).
 *
 * Spec: PROD-001
 */
import { describe, expect, it } from 'vitest';
import { isLearningDesignError } from '../../../src/http/learningDesignErrors.js';
import { choosePatternOption } from '../../../src/learningDesign/patterns/patternChoice.js';
import { fixturePatterns } from '../../support/fixturePattern.js';

const [twoOfEach] = fixturePatterns().patterns;
if (!twoOfEach) throw new Error('fixture missing');
const oneOfEach = {
  ...twoOfEach,
  phases: ['underveis'] as const,
  contentTypes: ['H5P.Blanks'] as const,
  skeletons: twoOfEach.skeletons.filter((s) => s.contentType === 'H5P.Blanks'),
};

const refused = (run: () => unknown): boolean => {
  try {
    run();
    return false;
  } catch (error) {
    return isLearningDesignError(error, 'hvl:pattern-choice-invalid');
  }
};

describe('[PROD-001] choosing what a pattern creates', () => {
  it('[PROD-001] takes the first phase and the only content type when the request names none', () => {
    const choice = choosePatternOption(oneOfEach, {});
    expect([choice.phase, choice.skeleton.contentType]).toEqual(['underveis', 'H5P.Blanks']);
  });

  it('[PROD-001] takes the phase and the content type the request names, among the pattern’s own', () => {
    const choice = choosePatternOption(twoOfEach, { phase: 'etterarbeid', contentType: 'H5P.Blanks' });
    expect([choice.phase, choice.skeleton.library]).toEqual(['etterarbeid', 'H5P.Blanks 1.14']);
  });

  it.each([
    ['a phase the pattern does not offer', { phase: 'underveis', contentType: 'H5P.Blanks' }],
    ['no content type for a pattern with two', { phase: 'forarbeid' }],
    ['a content type the pattern does not offer', { contentType: 'H5P.MultiChoice' }],
  ] as const)('[PROD-001] refuses %s with 400 hvl:pattern-choice-invalid', (_, request) => {
    expect(refused(() => choosePatternOption(twoOfEach, request))).toBe(true);
  });
});
