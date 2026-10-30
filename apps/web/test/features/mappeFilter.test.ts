/**
 * Tests for the `/mappe` picker's filter: course, phase and an inclusive range of change days in HVL's time zone, and
 * the course codes offered.
 *
 * Spec: MAPPE-001
 */
import { describe, expect, it } from 'vitest';
import {
  courseCodesOf,
  filterMappeActivities,
  NO_FILTERS,
  NONE,
  osloDay,
} from '../../src/features/mappe/mappeFilter';
import { MAPPE_ACTIVITIES } from '../support/mappeFixtures';

const titles = (filters: Partial<typeof NO_FILTERS>) =>
  filterMappeActivities(MAPPE_ACTIVITIES, { ...NO_FILTERS, ...filters }).map((item) => item.title);

describe('[MAPPE-001] filtering the picker', () => {
  it('[MAPPE-001] an empty filter keeps every activity in order; course and phase pick exact values or none', () => {
    expect(titles({})).toEqual(MAPPE_ACTIVITIES.map((item) => item.title));
    expect(titles({ course: 'SYK110', phase: 'forarbeid' })).toEqual(['Blodtrykk før samlinga']);
    expect(titles({ course: NONE })).toEqual(['Quiz without a course']);
    expect(titles({ phase: NONE })).toEqual(['Quiz without a course']);
    expect(courseCodesOf(MAPPE_ACTIVITIES)).toEqual(['SYK110']);
  });

  it('[MAPPE-001] the date range includes both days, counted in Oslo time', () => {
    // WHY: 23:30 UTC on 31 December is already 1 January in Oslo.
    expect(osloDay('2026-12-31T23:30:00.000Z')).toBe('2027-01-01');
    expect(osloDay('not a date')).toBe('');
    expect(titles({ from: '2026-09-15', to: '2026-10-20' })).toEqual([
      'Blodtrykk før samlinga',
      'Repetisjon etter samlinga',
    ]);
    expect(titles({ from: '2026-09-16' })).toEqual(['Blodtrykk før samlinga']);
    expect(titles({ to: '2026-08-01' })).toEqual(['Quiz without a course']);
  });
});
