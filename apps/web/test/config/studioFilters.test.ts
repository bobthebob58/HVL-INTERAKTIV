/**
 * Tests for reading the studio's filters and course back from an address: valid values pass, anything else is left
 * out, a shared address restores what the builder wrote, course codes are normalised as the server does, and the
 * web app's copies of the contract's lists stay equal to the contract.
 *
 * Spec: PED-003, PED-031, PED-030
 */
import {
  AUTHORABLE_CONTENT_TYPES,
  COURSE_CODE_PATTERN,
  courseCodeSchema,
  PHASE_KEYS,
  patternIdSchema,
  patternSummarySchema,
} from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { catalogueHref, patternPath, type StudioFilters } from '../../src/config/paths';
import {
  isPatternId,
  MAX_BUILD_MINUTES,
  normaliseCourseCode,
  PATTERN_ID_PATTERN,
  readStudioFilters,
  STUDIO_CONTENT_TYPES,
  STUDIO_COURSE_CODE_PATTERN,
  STUDIO_PHASE_KEYS,
} from '../../src/config/studioFilters';

const query = (href: string) => new URL(href, 'http://hvli.test').searchParams;

describe('[PED-003] the studio filters in the address', () => {
  it('[PED-003] a shared catalogue address restores every filter the builder wrote', () => {
    // Arrange
    const filters: StudioFilters = {
      phase: 'underveis',
      type: 'H5P.DragText',
      buildTime: 45,
      course: 'SYK110',
    };
    // Act
    const restored = readStudioFilters(query(catalogueHref(filters)));
    // Assert
    expect(restored).toEqual(filters);
    expect(readStudioFilters(query(catalogueHref()))).toEqual({});
  });

  it.each([
    ['an unknown phase', 'fase=samling', {}],
    ['a phase label instead of its key', 'fase=Mellomarbeid', {}],
    ['DragQuestion, which is never authorable', 'type=H5P.DragQuestion', {}],
    ['a build time of zero', 'tid=0', {}],
    ['a build time over 600 minutes', 'tid=601', {}],
    ['a build time that is not a whole number', 'tid=1.5', {}],
    ['an invalid course code', 'emne=%3Cx%3E', {}],
    [
      'a repeated phase, of which the first counts',
      'fase=forarbeid&fase=etterarbeid',
      { phase: 'forarbeid' },
    ],
  ] as const)('[PED-003] leaves out %s', (_case, search, expected) => {
    expect(readStudioFilters(new URLSearchParams(search))).toEqual(expected);
  });

  it('[PED-030] a course code is normalised as the server normalises it (D-087)', () => {
    // Arrange
    const inputs = [' syk 110 ', 'dat-100', 'Øk1', 'x', '-ab', ''];
    // Act
    const local = inputs.map((input) => normaliseCourseCode(input));
    const server = inputs.map((input) => {
      const parsed = courseCodeSchema.safeParse(input);
      return parsed.success ? parsed.data : undefined;
    });
    // Assert
    expect(local).toEqual(['SYK110', 'DAT-100', 'ØK1', undefined, undefined, undefined]);
    expect(local).toEqual(server);
    expect(readStudioFilters(new URLSearchParams('emne=%20syk%20110'))).toEqual({ course: 'SYK110' });
  });

  it('[PED-031] a pattern page reads the phase and course the planner sent', () => {
    const href = patternPath('ea-diagnose', { phase: 'etterarbeid', course: 'SYK110' });
    expect(readStudioFilters(query(href))).toEqual({ phase: 'etterarbeid', course: 'SYK110' });
  });

  it('[PED-003] a pattern ID from the address has the contract’s form', () => {
    expect(['fa-video', 'ea-diagnose'].every(isPatternId)).toBe(true);
    expect(['', 'FA-VIDEO', '../x', 'a', 'fa video', '1-a'].some(isPatternId)).toBe(false);
  });
});

describe('[PED-003] the web app’s copies of the contract', () => {
  it('[PED-003] the longest build time is the contract’s', () => {
    const buildMinutes = patternSummarySchema.shape.buildMinutes;
    expect(buildMinutes.safeParse(MAX_BUILD_MINUTES).success).toBe(true);
    expect(buildMinutes.safeParse(MAX_BUILD_MINUTES + 1).success).toBe(false);
  });

  it('[PED-003] phases, content types, the course-code and pattern-ID patterns equal the contract’s', () => {
    expect(STUDIO_PHASE_KEYS).toEqual(PHASE_KEYS);
    expect(STUDIO_CONTENT_TYPES).toEqual(AUTHORABLE_CONTENT_TYPES);
    expect(STUDIO_COURSE_CODE_PATTERN.source).toBe(COURSE_CODE_PATTERN.source);
    const ids = ['fa-video', 'ab', 'a', 'FA', '../x', 'a'.repeat(64), 'a'.repeat(65), 'x_y', '9a'];
    expect(ids.map(isPatternId)).toEqual(ids.map((id) => patternIdSchema.safeParse(id).success));
    expect(PATTERN_ID_PATTERN.flags).toBe('');
  });
});
