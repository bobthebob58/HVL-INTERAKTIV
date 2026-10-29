/**
 * mappeFilter — which of the author's activities the `/mappe` picker shows: by course, phase and a range of change
 * dates.
 *
 * Why: MAPPE-001 lets an author select activities "filtered by course, phase or date". The list is the author's own
 *      and co-authored activities, already in the browser, so filtering is instant and needs no request.
 * Spec: MAPPE-001
 * Invariants:
 *   - Pure; keeps the list's order.
 *   - `NONE` picks activities without a course (or phase); an empty filter picks everything.
 *   - Dates are compared as calendar days in HVL's time zone, both ends included, so «to 29 October» includes the
 *     whole day.
 * Collaborators: ./MappeWorkspace.tsx, ./MappeFilters.tsx, ../../i18n/formatDate.ts (`HVL_TIME_ZONE`).
 * Tests: apps/web/test/features/mappeFilter.test.ts
 */
import type { MappeActivity } from '@hvl-interaktiv/api-contract';
import { HVL_TIME_ZONE } from '../../i18n/formatDate';

/** The filter value that picks activities without a course code or without a phase. */
export const NONE = '-';

/** The picker's filters; an empty string means "any". */
export interface MappeFilters {
  readonly course: string;
  readonly phase: string;
  /** The first day, `YYYY-MM-DD`. */
  readonly from: string;
  /** The last day, `YYYY-MM-DD`. */
  readonly to: string;
}

/** No filter at all. */
export const NO_FILTERS: MappeFilters = { course: '', phase: '', from: '', to: '' };

const DAY = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: HVL_TIME_ZONE,
});

/**
 * The calendar day of a moment in HVL's time zone.
 * @param iso - An ISO date-time from the API.
 * @returns `YYYY-MM-DD`, or '' for an unreadable value.
 */
export function osloDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DAY.format(date);
}

const matches = (wanted: string, value: string | undefined): boolean =>
  wanted === '' || (wanted === NONE ? value === undefined : value === wanted);

/**
 * The activities that pass the filters.
 * @param items - The author's activities.
 * @param filters - The chosen filters.
 * @returns Those that match, in the same order.
 * @spec MAPPE-001
 */
export function filterMappeActivities(
  items: readonly MappeActivity[],
  filters: MappeFilters,
): MappeActivity[] {
  return items.filter((item) => {
    const day = osloDay(item.updatedAt);
    return (
      matches(filters.course, item.courseCode) &&
      matches(filters.phase, item.phase) &&
      (filters.from === '' || day >= filters.from) &&
      (filters.to === '' || day <= filters.to)
    );
  });
}

/**
 * The course codes the author's activities use, for the course filter.
 * @param items - The author's activities.
 * @returns The distinct codes, sorted.
 */
export const courseCodesOf = (items: readonly MappeActivity[]): string[] =>
  [...new Set(items.flatMap((item) => (item.courseCode ? [item.courseCode] : [])))].sort();
