/**
 * repetitionDates — the days on which a published *Etterarbeid* activity is suggested repeated: 7 and 21 days after
 * the day it was published.
 *
 * Why: PROD-014 shows the author suggested repetition dates after publishing an *Etterarbeid* activity. Practice
 *      lasts longest when it is spread over time, which is what the phase is for (spec 04 §3); the two distances
 *      are the specification's own example, and D-152 records why they are kept and where they could move.
 * Spec: PROD-014
 * Invariants:
 *   - PEDAGOGY: the suggestion is for the phase `etterarbeid` only; the dates count from the calendar day of the
 *     last publishing in HVL's time zone, never from a time of day, so a publishing late in the evening and one
 *     early the next morning give different days, and summer time moves nothing.
 *   - A date is a calendar day written `YYYY-MM-DD`, with no time and no zone.
 *   - Pure: no clock is read, nothing is stored; a time of publishing that cannot be read, or that lies past the
 *     years a date is written with four digits, gives no dates; it never throws.
 * Collaborators: ./RepetitionSuggestion.tsx, ../activity/tabs/CheckTab.tsx, ../../i18n/formatDate.ts.
 * Tests: apps/web/test/features/repetitionDates.test.ts
 */
import type { PhaseKey } from '@hvl-interaktiv/api-contract';
import { HVL_TIME_ZONE } from '../../i18n/formatDate';

/**
 * How many days after publishing each repetition is suggested.
 * PEDAGOGY: one repetition after a week and one after three, the example of PROD-014 (D-152).
 */
export const REPETITION_DAYS: readonly number[] = [7, 21];

/** The læringsdesign phase whose activities get the suggestion. */
export const REPETITION_PHASE: PhaseKey = 'etterarbeid';

/** One suggested repetition. */
export interface RepetitionDate {
  /** Days after the day of publishing. */
  readonly days: number;
  /** The calendar day, `YYYY-MM-DD`. */
  readonly date: string;
}

// WHY: a fixed locale with Latin digits, whatever the browser's own language; the parts are read by their type.
const OSLO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: HVL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The suggested repetition dates of an activity.
 * @param publishedAt - When the activity was last published, an ISO 8601 date-time from the API.
 * @returns One date per distance in {@link REPETITION_DAYS}, soonest first; none for an unreadable time.
 */
export function repetitionDates(publishedAt: string): RepetitionDate[] {
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return [];
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(OSLO_DAY.formatToParts(published).find((entry) => entry.type === type)?.value);
  const [year, month, day] = [part('year'), part('month'), part('day')];
  if (!(year >= 1 && year < 9999)) return [];
  // WHY: UTC has no summer time, so adding days to a UTC date at midnight always lands on a whole calendar day.
  return REPETITION_DAYS.map((days) => ({
    days,
    date: new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10),
  }));
}
