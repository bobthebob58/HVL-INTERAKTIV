/**
 * Unit tests of an insight view's scope: the fixed periods from midnight Oslo time (D-106), the content version
 * (PROD-013), the context (D-103) and the activity's list of contexts.
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
    ['7d', '2026-11-04T12:00:00Z', '2026-10-27T23:00:00.000Z'],
    ['14d', '2026-11-04T12:00:00Z', '2026-10-20T22:00:00.000Z'],
    ['30d', '2026-11-04T12:00:00Z', '2026-10-04T22:00:00.000Z'],
    ['semester', '2026-11-04T12:00:00Z', '2026-07-31T22:00:00.000Z'],
    ['semester', '2027-03-15T09:00:00Z', '2026-12-31T23:00:00.000Z'],
    ['semester', '2026-07-31T22:30:00Z', '2026-07-31T22:00:00.000Z'],
    ['semester', '2026-07-31T21:30:00Z', '2025-12-31T23:00:00.000Z'],
    ['7d', '2026-03-31T22:30:00Z', '2026-03-24T23:00:00.000Z'],
  ] as const)('[INS-006] %s computed at %s starts at %s, a midnight in Oslo', (period, now, start) => {
    const range = insightPeriodRange(period, new Date(now));
    expect(range.start.toISOString()).toBe(start);
    expect(range.end.toISOString()).toBe(new Date(now).toISOString());
  });

  it('[INS-006] puts every start at Oslo midnight whatever the moment, so two starts cannot split a day', () => {
    // Arrange: one moment every 7 hours through the daylight-saving change of October 2026.
    const moments = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 9, 20) + i * 7 * 3_600_000));
    // Act
    const starts = moments.map((now) => insightPeriodRange('7d', now).start);
    // Assert
    for (const start of starts) {
      const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', timeStyle: 'medium' }).format(
        start,
      );
      expect(clock).toBe('00:00:00');
    }
  });

  it('[INS-006] rolls a day before the 1st back into the previous month', () => {
    expect(osloMidnight({ year: 2026, month: 3, day: 0 }).toISOString()).toBe('2026-02-27T23:00:00.000Z');
  });
});

describe('[PROD-013] the version a view covers', () => {
  it('[PROD-013] is the current version by default, and an older one when asked', () => {
    expect(resolveInsightScope({ contentId: 'c', context: 'portal' }, facts).view.contentVersion).toBe(3);
    expect(resolveInsightScope({ contentId: 'c', context: 'portal', version: 1 }, facts).view).toMatchObject({
      contentVersion: 1,
      currentVersion: 3,
      period: '7d',
      k: 5,
      periodStart: '2026-10-27T23:00:00.000Z',
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
