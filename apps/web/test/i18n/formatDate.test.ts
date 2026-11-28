/**
 * Tests for dates in the page language and HVL's time zone, and for unreadable values.
 *
 * Spec: PROD-012, PROD-014
 */
import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatLongDate, INTL_LOCALE } from '../../src/i18n/formatDate';

describe('[PROD-012] dates in the page language', () => {
  it('[PROD-012] uses a Norwegian or British format and Norwegian local time', () => {
    expect(INTL_LOCALE).toEqual({ nn: ['nn-NO', 'nb-NO'], nb: ['nb-NO'], en: ['en-GB'] });
    expect(formatDate('2026-11-06T10:00:00.000Z', 'nb')).toBe('6. nov. 2026');
    expect(formatDate('2026-11-06T10:00:00.000Z', 'en')).toBe('6 Nov 2026');
    expect(formatDateTime('2026-10-23T22:30:00.000Z', 'en')).toBe('24 Oct 2026, 00:30');
  });

  it('[PROD-012] Nynorsk never falls back to American English, also where the browser lacks Nynorsk data', () => {
    expect(formatDate('2026-11-06T10:00:00.000Z', 'nn')).toMatch(/^6\. nov\.? 2026$/);
  });

  it('[PROD-014] writes a calendar day with its weekday, the day it names whatever the season', () => {
    // Act: a Saturday, which Bokmål and Nynorsk name differently and Chromium has no Nynorsk name for
    const saturday = (['nn', 'nb', 'en'] as const).map((locale) => formatLongDate('2026-12-05', locale));
    // Assert
    expect(saturday).toEqual([
      'laurdag 5. desember 2026',
      'lørdag 5. desember 2026',
      'Saturday 5 December 2026',
    ]);
    expect(formatLongDate('2026-12-04', 'nn')).toBe('fredag 4. desember 2026');
    expect(formatLongDate('2026-07-08', 'nb')).toBe('onsdag 8. juli 2026');
    expect(formatLongDate('2026-12-06T22:30:00.000Z', 'nn')).toBe('sundag 6. desember 2026');
    expect(formatLongDate('snart', 'nn')).toBe('snart');
  });

  it('[PROD-012] gives back a value it cannot read', () => {
    expect(formatDate('ikkje ein dato', 'nn')).toBe('ikkje ein dato');
    expect(formatDateTime('', 'nn')).toBe('');
  });
});
