/**
 * Unit tests of an insight view's scope: the fixed periods from and to midnight Oslo time, never across 1 August
 * (D-106 and its amendment of 2026-11-04), the content version (PROD-013), the context (D-103) and the activity's
 * list of contexts.
 *
 * Spec: INS-006, INS-007, PROD-013
 */
import { describe, expect, it } from 'vitest';
import { contextsOfPlacements } from '../../src/insight/scope/activityContexts.js';
import { insightPeriodRange, osloMidnight } from '../../src/insight/scope/insightPeriod.js';
import {
  InsightScopeError,
  resolveInsightScope,
  storedContextOf,
} from '../../src/insight/scope/insightScope.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';

const PLATFORM = '0b0e4a8e-4f8c-4f6e-9d0a-6f1d1c2b3a4e';
const COURSE = `${PLATFORM}:course:with:colons`;
const reasonOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    return error instanceof InsightScopeError ? error.reason : 'other';
  }
  return undefined;
};
const facts = {
  currentVersion: 3,
  contextLabel: 'SYK110',
  size: minimumGroupSize(5),
  now: new Date('2026-11-04T12:00:00Z'),
};

describe('[INS-006] fixed periods (D-106)', () => {
  it.each([
    ['7d', '2026-11-04T12:00:00Z', '2026-10-27T23:00:00.000Z', '2026-11-03T23:00:00.000Z'],
    ['14d', '2026-11-04T12:00:00Z', '2026-10-20T22:00:00.000Z', '2026-11-03T23:00:00.000Z'],
    ['30d', '2026-11-04T12:00:00Z', '2026-10-04T22:00:00.000Z', '2026-11-03T23:00:00.000Z'],
    ['semester', '2026-11-04T12:00:00Z', '2026-07-31T22:00:00.000Z', '2026-11-03T23:00:00.000Z'],
    ['semester', '2027-03-15T09:00:00Z', '2026-12-31T23:00:00.000Z', '2027-03-14T23:00:00.000Z'],
    // WHY: on 1 August (00:30 Oslo) the last day is 31 July, so the view is the spring semester, not an empty one.
    ['semester', '2026-07-31T22:30:00Z', '2025-12-31T23:00:00.000Z', '2026-07-31T22:00:00.000Z'],
    ['semester', '2026-07-31T21:30:00Z', '2025-12-31T23:00:00.000Z', '2026-07-30T22:00:00.000Z'],
    // WHY: on 1 January the last day is 31 December, so the view is the autumn semester.
    ['semester', '2027-01-01T10:00:00Z', '2026-07-31T22:00:00.000Z', '2026-12-31T23:00:00.000Z'],
    ['7d', '2026-03-31T22:30:00Z', '2026-03-24T23:00:00.000Z', '2026-03-31T22:00:00.000Z'],
  ] as const)(
    '[INS-006] %s computed at %s runs from %s to %s, both midnights in Oslo',
    (period, now, start, end) => {
      const range = insightPeriodRange(period, new Date(now));
      expect(range.start.toISOString()).toBe(start);
      expect(range.end.toISOString()).toBe(end);
    },
  );

  it('[INS-006] puts every start and end at Oslo midnight whatever the moment, so two views cannot split a day', () => {
    // Arrange: one moment every 7 hours through the daylight-saving change of October 2026.
    const moments = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 9, 20) + i * 7 * 3_600_000));
    // Act
    const ranges = moments.map((now) => insightPeriodRange('7d', now));
    // Assert
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', timeStyle: 'medium' });
    for (const { start, end } of ranges) {
      expect(clock.format(start)).toBe('00:00:00');
      expect(clock.format(end)).toBe('00:00:00');
    }
  });

  it('[INS-006] ends every view at the start of today, so views at 00:00:01 and 23:59:59 of one day are the same', () => {
    // Arrange: the first and the last second of 4 November 2026 in Oslo (CET)
    const first = new Date('2026-11-03T23:00:01Z');
    const last = new Date('2026-11-04T22:59:59Z');
    // Act
    const views = [first, last].map((now) => insightPeriodRange('30d', now));
    // Assert
    expect(views[0]).toEqual(views[1]);
    expect(views[0]?.end.toISOString()).toBe('2026-11-03T23:00:00.000Z');
  });

  it('[INS-006] rolls a day before the 1st back into the previous month', () => {
    expect(osloMidnight({ year: 2026, month: 3, day: 0 }).toISOString()).toBe('2026-02-27T23:00:00.000Z');
  });
});

describe('[INS-006] no view crosses 1 August, when the learners get new keys (D-106 amendment)', () => {
  // WHY: July and August are summer time in Oslo (UTC+2), so midnight on day d of August 2027 is d − 1 at 22:00Z.
  const midnight = (day: number): number => Date.UTC(2027, 7, day) - 2 * 3_600_000;
  const AUGUST_1 = midnight(1);
  const DAYS = { '7d': 7, '14d': 14, '30d': 30 } as const;

  it.each(Array.from({ length: 31 }, (_, i) => i + 1))(
    '[INS-006] on %i August 2027 the 7-, 14- and 30-day views start no earlier than the year their last day is in',
    (day) => {
      // Arrange: noon in Oslo
      const now = new Date(midnight(day) + 12 * 3_600_000);
      for (const [period, days] of Object.entries(DAYS) as [keyof typeof DAYS, number][]) {
        // Act
        const range = insightPeriodRange(period, now);
        // Assert: from 2 August, the view is 2027/28 and starts on 1 August at the earliest (shortened while
        // day ≤ N); on 1 August its last day is 31 July, so it is 2026/27 and keeps its N whole days.
        const year = day === 1 ? 2026 : 2027;
        const nominal = midnight(day - days);
        const expected = day === 1 ? nominal : Math.max(nominal, AUGUST_1);
        expect(range.academicYear).toBe(year);
        expect(range.end.getTime()).toBe(midnight(day));
        expect(range.start.getTime()).toBe(expected);
        expect(range.start.getTime() < AUGUST_1 && range.end.getTime() > AUGUST_1).toBe(false);
      }
    },
  );

  it('[INS-006] shortens the 7-day view from 2 to 7 August and leaves it whole from 8 August', () => {
    const shortened = Array.from({ length: 10 }, (_, i) => i + 1).filter((day) => {
      const range = insightPeriodRange('7d', new Date(midnight(day) + 3_600_000));
      return range.end.getTime() - range.start.getTime() < 7 * 86_400_000;
    });
    expect(shortened).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('[INS-006] the semester never needs it: 1 August shows the spring semester, 2 August the autumn one', () => {
    const onFirst = insightPeriodRange('semester', new Date(midnight(1) + 3_600_000));
    const onSecond = insightPeriodRange('semester', new Date(midnight(2) + 3_600_000));
    expect(onFirst).toMatchObject({ academicYear: 2026, start: new Date('2026-12-31T23:00:00.000Z') });
    expect(onSecond).toMatchObject({ academicYear: 2027, start: new Date(AUGUST_1) });
  });
});

describe('[PROD-013] the version a view covers', () => {
  it('[PROD-013] is the current version by default, and an older one when asked', () => {
    // Act
    const current = resolveInsightScope({ contentId: 'c', context: 'portal' }, facts);
    const older = resolveInsightScope({ contentId: 'c', context: 'portal', version: 1 }, facts);
    // Assert
    expect(current.view.contentVersion).toBe(3);
    expect(current.academicYear).toBe(2026);
    expect(older.view).toMatchObject({
      contentVersion: 1,
      currentVersion: 3,
      period: '7d',
      k: 5,
      periodStart: '2026-10-27T23:00:00.000Z',
      periodEnd: '2026-11-03T23:00:00.000Z',
    });
  });

  it.each([0, 4, 1.5])('[PROD-013] refuses version %d', (version) => {
    expect(reasonOf(() => resolveInsightScope({ contentId: 'c', context: 'portal', version }, facts))).toBe(
      'versionUnavailable',
    );
  });
});

describe('[INS-007] the context a view covers (D-103)', () => {
  it('[INS-007] stores the portal as no context and a course as its platform-scoped key', () => {
    expect(storedContextOf('portal')).toBeNull();
    expect(storedContextOf(COURSE)).toBe(COURSE);
    const scope = resolveInsightScope({ contentId: 'c', context: COURSE, period: '30d' }, facts);
    expect(scope.view.context).toEqual({ key: COURSE, label: 'SYK110' });
    expect(resolveInsightScope({ contentId: 'c', context: 'portal' }, facts).view.context.label).toBeNull();
  });

  it.each(['course-1', `${PLATFORM.toUpperCase()}:x`, `${PLATFORM}:`])(
    '[INS-007] refuses the context %s',
    (key) => {
      expect(reasonOf(() => storedContextOf(key))).toBe('contextInvalid');
    },
  );

  it('[INS-007] lists the portal first, then each course once with its newest label', () => {
    // Arrange
    const placements = [
      { platformId: PLATFORM, contextId: 'A', contextLabel: 'SYK110' },
      { platformId: PLATFORM, contextId: 'B', contextLabel: null },
      { platformId: PLATFORM, contextId: 'A', contextLabel: ' SYK111 ' },
      { platformId: 'not-a-uuid', contextId: 'C', contextLabel: 'X' },
    ];
    // Act
    const contexts = contextsOfPlacements(placements);
    // Assert
    expect(contexts).toEqual([
      { key: 'portal', label: null },
      { key: `${PLATFORM}:A`, label: 'SYK111' },
      { key: `${PLATFORM}:B`, label: null },
    ]);
  });
});
