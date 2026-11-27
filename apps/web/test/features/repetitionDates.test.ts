/**
 * Tests for the suggested repetition dates of a published *Etterarbeid* activity: the calendar days 7 and 21 days
 * after the day of publishing, counted in Oslo time, whatever the hour and whatever lies between (summer time, the
 * turn of the year).
 *
 * Spec: PROD-014
 */
import { describe, expect, it, vi } from 'vitest';
import {
  REPETITION_DAYS,
  REPETITION_PHASE,
  repetitionDates,
} from '../../src/features/learningDesign/repetitionDates';

const dates = (publishedAt: string) => repetitionDates(publishedAt).map(({ date }) => date);

describe('[PROD-014] suggested repetition dates', () => {
  it('[PROD-014] are 7 and 21 days after the day of publishing, for an Etterarbeid activity', () => {
    // Act
    const suggested = repetitionDates('2026-11-27T19:00:00.000Z');
    // Assert
    expect(suggested).toEqual([
      { days: 7, date: '2026-12-04' },
      { days: 21, date: '2026-12-18' },
    ]);
    expect([REPETITION_DAYS, REPETITION_PHASE]).toEqual([[7, 21], 'etterarbeid']);
  });

  it.each([
    [
      'half an hour before midnight in UTC, which is the next day in Oslo',
      '2026-11-27T23:30:00.000Z',
      '2026-12-05',
    ],
    ['the last minute of a day in Oslo', '2026-11-27T22:59:59.000Z', '2026-12-04'],
    ['the first minute of a summer day in Oslo', '2026-06-30T22:00:00.000Z', '2026-07-08'],
  ])('[PROD-014] count from the Oslo calendar day: %s', (_what, publishedAt, first) => {
    // Act and assert
    expect(dates(publishedAt)[0]).toBe(first);
  });

  it.each([
    ['the end of summer time (25 October 2026)', '2026-10-20T22:30:00.000Z', ['2026-10-28', '2026-11-11']],
    ['the start of summer time (28 March 2027)', '2027-03-21T22:30:00.000Z', ['2027-03-28', '2027-04-11']],
    ['the turn of the year', '2026-12-20T10:00:00.000Z', ['2026-12-27', '2027-01-10']],
    ['the end of February in a leap year', '2028-02-22T10:00:00.000Z', ['2028-02-29', '2028-03-14']],
  ])('[PROD-014] are whole calendar days across %s', (_what, publishedAt, expected) => {
    // Act and assert
    expect(dates(publishedAt)).toEqual(expected);
  });

  it('[PROD-014] are the same days in a browser on the other side of the world', () => {
    // Arrange
    vi.stubEnv('TZ', 'Pacific/Auckland');
    // Act and assert
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-780);
    expect(dates('2026-11-27T23:30:00.000Z')).toEqual(['2026-12-05', '2026-12-19']);
    vi.unstubAllEnvs();
  });

  it.each([[''], ['i går'], ['2026-13-45T00:00:00Z'], ['9999-12-20T10:00:00.000Z']])(
    '[PROD-014] a time of publishing that cannot be read or written (%j) gives no dates',
    (publishedAt) => {
      // Act and assert
      expect(repetitionDates(publishedAt)).toEqual([]);
    },
  );
});
