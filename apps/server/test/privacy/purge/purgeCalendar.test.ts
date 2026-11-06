/**
 * Unit tests for the yearly purge's calendar (D-107 and its amendment of 2026-11-04): the run date's rule (31 August
 * to 31 December, default 31 August), when a run is due in Oslo time around 31 July, 1 August and 31 August, and what
 * a run at a moment covers.
 *
 * Spec: DATA-003
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PURGE_RUN_DATE,
  academicYearStart,
  isPurgeDue,
  parsePurgeRunDate,
  purgeRunsFrom,
  purgeScopeAt,
} from '../../../src/privacy/purge/purgeCalendar.js';

/** Oslo wall-clock moments of 2011 (summer time, UTC+2; winter time from 30 October, UTC+1). */
const OSLO = {
  lastMomentOf31July: new Date('2011-07-31T21:59:59.999Z'),
  firstOfAugust: new Date('2011-07-31T22:00:00.000Z'),
  lastMomentOf30August: new Date('2011-08-30T21:59:59.999Z'),
  thirtyFirstOfAugust: new Date('2011-08-30T22:00:00.000Z'),
};

describe('[DATA-003] the purge run date', () => {
  it.each(['08-31', '09-01', '09-30', '10-15', '12-31', ' 11-30 '])(
    '[DATA-003] accepts %s, a day from 31 August to 31 December',
    (raw) => {
      expect(parsePurgeRunDate(raw)).toEqual({
        month: Number(raw.trim().slice(0, 2)),
        day: Number(raw.trim().slice(3)),
      });
    },
  );

  it.each([
    '08-30',
    '08-15',
    '08-01',
    '07-31',
    '01-15',
    '09-31',
    '02-30',
    '13-01',
    '8-31',
    '0831',
    'abc',
    '',
  ])('[DATA-003] refuses %j: before 31 August, in January to July, or not a date (D-107)', (raw) => {
    expect(() => parsePurgeRunDate(raw)).toThrow('must be a day from 08-31 to 12-31, written MM-DD (D-107)');
  });

  it('[DATA-003] defaults to 31 August and refuses a date built by hand before it', () => {
    // Act and assert
    expect(DEFAULT_PURGE_RUN_DATE).toEqual({ month: 8, day: 31 });
    expect(() => purgeRunsFrom({ month: 8, day: 15 }, OSLO.thirtyFirstOfAugust)).toThrow(RangeError);
    expect(() => isPurgeDue({ month: 3, day: 1 }, OSLO.thirtyFirstOfAugust)).toThrow(RangeError);
  });
});

describe('[DATA-003] when the purge is due, in Oslo time', () => {
  it('[DATA-003] on 31 July the year that is ending is still current; the year before it is the ended one', () => {
    // Act
    const scope = purgeScopeAt(OSLO.lastMomentOf31July);
    // Assert
    expect(scope).toEqual({
      currentYear: 2010,
      endedYear: 2009,
      cutoff: new Date('2010-07-31T22:00:00.000Z'),
    });
    expect(isPurgeDue(DEFAULT_PURGE_RUN_DATE, OSLO.lastMomentOf31July)).toBe(true);
  });

  it('[DATA-003] from 1 August to 30 August the year that just ended is not yet due', () => {
    // Act and assert
    expect(purgeScopeAt(OSLO.firstOfAugust)).toEqual({
      currentYear: 2011,
      endedYear: 2010,
      cutoff: new Date('2011-07-31T22:00:00.000Z'),
    });
    expect(isPurgeDue(DEFAULT_PURGE_RUN_DATE, OSLO.firstOfAugust)).toBe(false);
    expect(isPurgeDue(DEFAULT_PURGE_RUN_DATE, OSLO.lastMomentOf30August)).toBe(false);
  });

  it('[DATA-003] it is due from midnight in Oslo on 31 August until the academic year ends', () => {
    // Act and assert
    expect(purgeRunsFrom(DEFAULT_PURGE_RUN_DATE, OSLO.firstOfAugust)).toEqual(OSLO.thirtyFirstOfAugust);
    expect(isPurgeDue(DEFAULT_PURGE_RUN_DATE, OSLO.thirtyFirstOfAugust)).toBe(true);
    expect(isPurgeDue(DEFAULT_PURGE_RUN_DATE, new Date('2012-07-31T21:59:59.999Z'))).toBe(true);
    expect(purgeScopeAt(OSLO.thirtyFirstOfAugust).endedYear).toBe(2010);
  });

  it('[DATA-003] a later configured date moves the start, in winter time too', () => {
    // Arrange
    const firstOfDecember = parsePurgeRunDate('12-01');
    // Act and assert
    expect(isPurgeDue(parsePurgeRunDate('09-15'), OSLO.thirtyFirstOfAugust)).toBe(false);
    expect(isPurgeDue(parsePurgeRunDate('09-15'), new Date('2011-09-14T22:00:00.000Z'))).toBe(true);
    expect(purgeRunsFrom(firstOfDecember, OSLO.firstOfAugust)).toEqual(new Date('2011-11-30T23:00:00.000Z'));
  });

  it('[DATA-003] an academic year starts at midnight in Oslo on 1 August', () => {
    expect(academicYearStart(2025)).toEqual(new Date('2025-07-31T22:00:00.000Z'));
  });
});
