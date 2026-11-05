/**
 * insightPeriod — when an insight view starts and ends: the last 7, 14 or 30 days or since the semester started, each
 * from midnight Oslo time, up to the latest midnight in Oslo, and never across 1 August.
 *
 * Why: spec 05 §1 asks for results "since a chosen date (default 7 days ago)". A free date lets a teacher open two
 *      views a day apart and subtract one from the other to isolate one learner (differencing). D-106 allows only
 *      fixed periods that each start at a midnight in Oslo, so a start date can never be placed between two plays.
 *      Its amendment of 2026-11-04 (the step-4 privacy review) ends every period at a midnight too, so two views on
 *      the same day never differ by what one learner did in between, and keeps a view inside one academic year, so a
 *      learner is never counted under two years' pseudonyms (DATA-002, D-057).
 * Spec: INS-001, INS-006
 * Invariants:
 *   - SPEC-DEVIATION: D-106 — the period is one of `7d`, `14d`, `30d` or `semester` (the contract's
 *     `INSIGHT_PERIODS`), never a free date; `7d` is the default (`DEFAULT_INSIGHT_PERIOD`).
 *   - SPEC-DEVIATION: D-106 — the end is the latest midnight in Oslo at or before the moment (exclusive), so a view
 *     holds the data up to and including yesterday and never today's.
 *   - `Nd` starts at midnight Oslo time N calendar days before the end, so it covers N whole days; `semester` starts at
 *     midnight Oslo time on 1 August when the period's last day (yesterday) is in August to December, else on
 *     1 January (D-106: until HVL gives its semester dates).
 *   - The view belongs to the academic year of its last day, and no start is before 1 August 00:00 Oslo of that year:
 *     a start that would be earlier is moved there, so the period is shortened (`7d` from 2 to 7 August, `14d` to 14
 *     August, `30d` to 30 August); the semester never needs it.
 *   - The result does not depend on the server's own time zone; Norway's daylight-saving changes happen at 01:00
 *     UTC, never at midnight, so each midnight exists exactly once.
 * Collaborators: ../../privacy/academicYear.ts (`ACADEMIC_TIME_ZONE`, `academicYearOf`), @hvl-interaktiv/api-contract
 *   (`InsightPeriod`), ./insightScope.ts.
 * Tests: apps/server/test/insight/insightScope.test.ts, apps/server/test/insight/insightPeriodEnd.int.test.ts
 */
import type { InsightPeriod } from '@hvl-interaktiv/api-contract';
import { ACADEMIC_TIME_ZONE, academicYearOf } from '../../privacy/academicYear.js';

/** The moments a view covers: from `start` (inclusive) to `end` (exclusive), within one academic year. */
export interface InsightPeriodRange {
  /** Midnight Oslo time at the period's first day; never before 1 August of `academicYear`. */
  readonly start: Date;
  /** The latest midnight in Oslo at or before the moment the view is computed: the start of today. */
  readonly end: Date;
  /** The academic year of the period's last day (yesterday), e.g. 2026 for 2026/27; other years' rows are left out. */
  readonly academicYear: number;
}

/** A calendar date in Oslo. */
interface OsloDate {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
  readonly day: number;
}

const osloParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ACADEMIC_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** The Oslo wall clock of a moment, as numbers. */
function wallClock(at: Date): Record<string, number> {
  return Object.fromEntries(
    osloParts
      .formatToParts(at)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

/**
 * The calendar date in Oslo of a moment.
 * @param at - The moment.
 * @returns The Oslo date.
 */
export function osloDateOf(at: Date): OsloDate {
  const { year = 0, month = 1, day = 1 } = wallClock(at);
  return { year, month, day };
}

/**
 * Midnight Oslo time at the start of a calendar date.
 * @param date - The date; a day or month out of range rolls over, as `Date.UTC` does (e.g. day 0).
 * @returns The moment Oslo's clocks show 00:00 that day.
 */
export function osloMidnight(date: OsloDate): Date {
  const utcMidnight = Date.UTC(date.year, date.month - 1, date.day);
  const clock = wallClock(new Date(utcMidnight));
  // WHY: Oslo is UTC+1 or UTC+2 and changes at 01:00 UTC, so the offset at UTC midnight is the offset at Oslo's.
  const offset =
    Date.UTC(clock.year ?? 0, (clock.month ?? 1) - 1, clock.day, clock.hour, clock.minute, clock.second) -
    utcMidnight;
  return new Date(utcMidnight - offset);
}

const DAYS: Readonly<Record<Exclude<InsightPeriod, 'semester'>, number>> = { '7d': 7, '14d': 14, '30d': 30 };

/**
 * The range of a fixed period.
 * @param period - `7d`, `14d`, `30d` or `semester`.
 * @param now - The moment the view is computed.
 * @returns From midnight Oslo time at the period's first day (not before 1 August of its academic year) up to the
 *   latest midnight in Oslo, and the academic year the view belongs to.
 * @example
 * insightPeriodRange('7d', new Date('2027-08-03T10:00:00Z')); // 1 Aug 2027 00:00 to 3 Aug 00:00 Oslo, year 2027
 * @spec INS-006
 */
export function insightPeriodRange(period: InsightPeriod, now: Date): InsightPeriodRange {
  const today = osloDateOf(now);
  // SPEC-DEVIATION: D-106 — the view ends at the start of today, so two views on one day are always the same.
  const end = osloMidnight(today);
  const lastDay = new Date(end.getTime() - 1);
  const academicYear = academicYearOf(lastDay);
  const { year, month } = osloDateOf(lastDay);
  // SPEC-DEVIATION: D-106 — fixed periods from an Oslo midnight, not "since a chosen date" (spec 05 §1).
  const nominal =
    period === 'semester'
      ? osloMidnight({ year, month: month >= 8 ? 8 : 1, day: 1 })
      : osloMidnight({ ...today, day: today.day - DAYS[period] });
  // PRIVACY: a learner's key changes on 1 August (DATA-002); a view across it would count them twice (D-106).
  const yearStart = osloMidnight({ year: academicYear, month: 8, day: 1 });
  return { start: nominal < yearStart ? yearStart : nominal, end, academicYear };
}
