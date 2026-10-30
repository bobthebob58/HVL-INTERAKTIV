/**
 * Unit tests for what a placement keeps of a launch's course label: a course code with a digit, cleaned and cut, and
 * nothing of a label that might name a person.
 *
 * Spec: PED-030, DATA-002
 */
import { describe, expect, it } from 'vitest';
import {
  COURSE_LABEL_MAX_CODE_POINTS,
  placementCourseLabel,
} from '../../../src/lti/placements/courseLabel.js';

describe('[PED-030] the course label a placement keeps', () => {
  it.each([
    ['SYK110', 'SYK110'],
    ['syk 110', 'syk 110'],
    ['PED-3001', 'PED-3001'],
    ['ÆØÅ101', 'ÆØÅ101'],
  ])('[PED-030] keeps the course code %j as %j', (label, kept) => {
    expect(placementCourseLabel(label)).toBe(kept);
  });

  it.each([
    ['a teacher’s sandbox', 'Sandkasse Kari Nordmann'],
    ['a name that fits the pattern but has no digit', 'KARINORDMANN'],
    ['an underscore Canvas adds to a section', 'SYK110_1'],
    ['a code longer than 20 characters', 'SYK110SYKEPLEIEHAUST2026'],
    ['an empty label', ''],
    ['only spaces', '   '],
  ])('[DATA-002] keeps nothing of %s', (_what, label) => {
    expect(placementCourseLabel(label)).toBeNull();
  });

  it('[DATA-002] keeps nothing when the claim is missing or not a string', () => {
    for (const label of [undefined, null, 110, { label: 'SYK110' }, ['SYK110']]) {
      expect(placementCourseLabel(label)).toBeNull();
    }
  });

  it('[PED-030] removes control characters before it decides', () => {
    // Act
    const kept = placementCourseLabel('SYK\u0000110\u0007');
    const tabbed = placementCourseLabel('SYK\t110');
    // Assert
    expect(kept).toBe('SYK110');
    expect(tabbed).toBe('SYK110');
  });

  it('[PED-030] cuts the label to 255 code points, never inside a surrogate pair, before it decides', () => {
    // Arrange: leading spaces are removed by the normalisation, so a long label can still hold a course code
    const padded = `${' '.repeat(COURSE_LABEL_MAX_CODE_POINTS - 6)}SYK110`;
    const tooLong = `${' '.repeat(COURSE_LABEL_MAX_CODE_POINTS - 3)}SYK110`;
    const astral = `${'😀'.repeat(COURSE_LABEL_MAX_CODE_POINTS)}SYK110`;
    // Act
    const kept = placementCourseLabel(padded);
    const cut = placementCourseLabel(tooLong);
    // Assert
    expect(kept).toBe(padded);
    expect([...(kept ?? '')]).toHaveLength(COURSE_LABEL_MAX_CODE_POINTS);
    expect(cut).toBeNull();
    expect(placementCourseLabel(astral)).toBeNull();
  });
});
