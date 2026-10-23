/**
 * formatDate — writes a date from the API (ISO 8601, UTC) as a date and time in the page's language.
 *
 * Why: lists and findings show when an activity changed and when an acknowledgement expires; the format follows the
 *      UI locale (PROD-012) and HVL's time zone, so a reader in Bergen sees Norwegian local time.
 * Spec: PROD-012
 * Invariants:
 *   - Never throws: an unreadable value comes back as it was.
 *   - Only called in the browser after data has arrived, so server and client never render it differently.
 *   - A locale the browser lacks falls back to the next tag (Nynorsk to Bokmål), never to American English.
 * Collaborators: ./translate.ts, ../components/FindingsList.tsx, ../features/portal/ActivityList.tsx.
 * Tests: apps/web/test/i18n/formatDate.test.ts
 */
import type { Locale } from './translate';

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

/**
 * Formats an ISO date for display.
 * @param iso - An ISO 8601 date-time from the API.
 * @param locale - The page locale.
 * @returns For example `23. okt. 2026, 14:05` in Nynorsk.
 */
export function formatDateTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat([...INTL_LOCALE[locale]], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: HVL_TIME_ZONE,
  }).format(date);
}

/**
 * Formats an ISO date as a date only.
 * @param iso - An ISO 8601 date-time from the API.
 * @param locale - The page locale.
 * @returns For example `6. nov. 2026` in Nynorsk.
 */
export function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat([...INTL_LOCALE[locale]], {
    dateStyle: 'medium',
    timeZone: HVL_TIME_ZONE,
  }).format(date);
}
