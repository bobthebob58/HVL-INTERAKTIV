/**
 * formatDate — writes a date from the API (ISO 8601, UTC) as a date and time in the page's language.
 *
 * Why: lists and findings show when an activity changed and when an acknowledgement expires; the format follows the
 *      UI locale (PROD-012) and HVL's time zone, so a reader in Bergen sees Norwegian local time.
 * Spec: PROD-012, PROD-014
 * Invariants:
 *   - Never throws: an unreadable value comes back as it was.
 *   - Only called in the browser after data has arrived, so server and client never render it differently.
 *   - A locale the browser lacks falls back to the next tag (Nynorsk to Bokmål), never to American English.
 *   - A weekday's name is our own text (`weekday.*`), because Bokmål names two of the days otherwise than Nynorsk.
 * Collaborators: ./translate.ts, ../components/FindingsList.tsx, ../features/portal/ActivityList.tsx,
 *   ../features/learningDesign/RepetitionSuggestion.tsx.
 * Tests: apps/web/test/i18n/formatDate.test.ts
 */
import { t, type Locale, type MessageKey } from './translate';

/**
 * The BCP 47 tags each UI locale formats with, best first.
 * WHY: Chromium's ICU has no Nynorsk data and would fall back to American English; Bokmål formats dates the same way.
 */
export const INTL_LOCALE: Readonly<Record<Locale, readonly string[]>> = {
  nn: ['nn-NO', 'nb-NO'],
  nb: ['nb-NO'],
  en: ['en-GB'],
};

/** The time zone HVL works in. */
export const HVL_TIME_ZONE = 'Europe/Oslo';

const format = (iso: string, locale: Locale, style: Intl.DateTimeFormatOptions): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatter = new Intl.DateTimeFormat([...INTL_LOCALE[locale]], { ...style, timeZone: HVL_TIME_ZONE });
  return formatter.format(date);
};

/**
 * Formats an ISO date for display.
 * @param iso - An ISO 8601 date-time from the API.
 * @param locale - The page locale.
 * @returns For example `23. okt. 2026, 14:05` in Nynorsk.
 */
export function formatDateTime(iso: string, locale: Locale): string {
  return format(iso, locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Formats an ISO date as a date only.
 * @param iso - An ISO 8601 date-time from the API.
 * @param locale - The page locale.
 * @returns For example `6. nov. 2026` in Nynorsk.
 */
export function formatDate(iso: string, locale: Locale): string {
  return format(iso, locale, { dateStyle: 'medium' });
}

/** The weekdays' names in our own texts, Sunday first, and the English short names `Intl` gives them by. */
const WEEKDAY_KEYS: readonly MessageKey[] = [
  'weekday.sunday',
  'weekday.monday',
  'weekday.tuesday',
  'weekday.wednesday',
  'weekday.thursday',
  'weekday.friday',
  'weekday.saturday',
];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a calendar day with its weekday, for a date a person plans by.
 * @param iso - A calendar day `YYYY-MM-DD`, or an ISO 8601 date-time from the API.
 * @param locale - The page locale.
 * @returns For example `laurdag 5. desember 2026` in Nynorsk.
 */
export function formatLongDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // WHY: a day without a time is read as midnight UTC, which is the same calendar day in Oslo all year.
  const short = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: HVL_TIME_ZONE }).format(date);
  const key = WEEKDAY_KEYS[WEEKDAY_SHORT.indexOf(short)];
  // WHY: Chromium has no Nynorsk data and would write Bokmål's «lørdag» and «søndag»; the day's name is our text.
  return `${key ? `${t(key, locale)} ` : ''}${format(iso, locale, { dateStyle: 'long' })}`;
}
