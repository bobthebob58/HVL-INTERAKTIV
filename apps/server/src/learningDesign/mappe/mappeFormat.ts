/**
 * mappeFormat — writes the pedagogisk mappe's dates and numbers as text in the portfolio's language, before Mustache
 * sees them.
 *
 * Why: D-094's probe amendment formats dates and numbers as strings first, so Mustache never stringifies a value and
 *      the Markdown escaper always gets text. Numbers use the language's grouping (7 500 with a no-break space in
 *      Norwegian), which also keeps a number one word in the Del 1 word count (./mappeWordCount.ts).
 * Spec: MAPPE-002, PROD-012
 * Invariants:
 *   - Dates are in HVL's time zone (Europe/Oslo); Nynorsk falls back to Bokmål formats where ICU lacks Nynorsk.
 *   - Pure: no clock is read here; the caller passes every date.
 * Collaborators: ./mappeActivityView.ts, ./mappeView.ts, ./MappeRenderer.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeView.test.ts
 */
import type { Locale } from '../../i18n/translate.js';

/** The BCP 47 tags each language formats with, best first (as the web app's formatDate). */
const INTL_LOCALE: Readonly<Record<Locale, readonly string[]>> = {
  nn: ['nn-NO', 'nb-NO'],
  nb: ['nb-NO'],
  en: ['en-GB'],
};

/** HVL's time zone. */
export const MAPPE_TIME_ZONE = 'Europe/Oslo';

/** Formats the portfolio's dates and numbers in one language. */
export interface MappeFormat {
  readonly locale: Locale;
  /** A date such as `29. oktober 2026`. */
  date(value: Date): string;
  /** A whole or decimal number such as `7 500` or `2,5`. */
  number(value: number): string;
  /** A rate between 0 and 1 as a whole percentage, such as `75 %`. */
  percent(rate: number): string;
  /** A signed number with one decimal, such as `+12,3`. */
  signed(value: number): string;
}

/**
 * The formats of one language.
 * @param locale - The portfolio's language.
 * @returns The formatters.
 * @spec MAPPE-002
 */
export function mappeFormat(locale: Locale): MappeFormat {
  const tags = [...INTL_LOCALE[locale]];
  const dates = new Intl.DateTimeFormat(tags, { dateStyle: 'long', timeZone: MAPPE_TIME_ZONE });
  const numbers = new Intl.NumberFormat(tags, { maximumFractionDigits: 1 });
  const percents = new Intl.NumberFormat(tags, { style: 'percent', maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(tags, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  return {
    locale,
    date: (value) => dates.format(value),
    number: (value) => numbers.format(value),
    percent: (rate) => percents.format(rate),
    signed: (value) => signed.format(value),
  };
}

/**
 * The calendar date in HVL's time zone, as `YYYY-MM-DD`, for a file name.
 * @param value - The moment.
 * @returns e.g. `2026-10-29`.
 */
export function isoDateInOslo(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: MAPPE_TIME_ZONE,
  }).format(value);
}
