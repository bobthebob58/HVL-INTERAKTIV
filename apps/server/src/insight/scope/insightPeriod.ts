/**
 * insightPeriod — when an insight view starts and ends: the last 7, 14 or 30 days or since the semester started, each
 * from midnight Oslo time, up to the moment the view is computed.
 *
 * Why: spec 05 §1 asks for results "since a chosen date (default 7 days ago)". A free date lets a teacher open two
 *      views a day apart and subtract one from the other to isolate one learner (differencing). D-106 allows only
 *      fixed periods that each start at a midnight in Oslo, so a start date can never be placed between two plays.
 * Spec: INS-001, INS-006
 * Invariants:
 *   - SPEC-DEVIATION: D-106 — the period is one of `7d`, `14d`, `30d` or `semester` (the contract's
 *     `INSIGHT_PERIODS`), never a free date; `7d` is the default (`DEFAULT_INSIGHT_PERIOD`).
 *   - `Nd` starts at midnight Oslo time N calendar days before today (Oslo), so it always covers the last N × 24
 *     hours; `semester` starts at midnight Oslo time on 1 August from August to December and on 1 January otherwise
 *     (D-106: until HVL gives its semester dates). The end is the given moment.
 *   - The result does not depend on the server's own time zone; Norway's daylight-saving changes happen at 01:00
 *     UTC, never at midnight, so each midnight exists exactly once.
 * Collaborators: ../../privacy/academicYear.ts (`ACADEMIC_TIME_ZONE`), @hvl-interaktiv/api-contract
 *   (`InsightPeriod`), ./insightScope.ts.
 * Tests: apps/server/test/insight/insightScope.test.ts
 */
import type { InsightPeriod } from '@hvl-interaktiv/api-contract';
import { ACADEMIC_TIME_ZONE } from '../../privacy/academicYear.js';

/** The moments a view covers: from `start` (inclusive) to `end` (exclusive). */
export interface InsightPeriodRange {
  /** Midnight Oslo time at the period's first day. */
  readonly start: Date;
  /** When the view was computed. */
  readonly end: Date;
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
 * @returns From midnight Oslo time at the period's first day up to `now`.
 * @spec INS-006
 */
export function insightPeriodRange(period: InsightPeriod, now: Date): InsightPeriodRange {
  const today = osloDateOf(now);
  // SPEC-DEVIATION: D-106 — fixed periods from an Oslo midnight, not "since a chosen date" (spec 05 §1).
  const start =
    period === 'semester'
      ? osloMidnight({ year: today.year, month: today.month >= 8 ? 8 : 1, day: 1 })
      : osloMidnight({ ...today, day: today.day - DAYS[period] });
  return { start, end: now };
}
