/**
 * purgeCalendar — when the yearly purge may run, and which moments bound what it takes: the configured run date
 * (`PURGE_RUN_DATE`, default 31 August), whether a moment has reached it, and the current academic year's start.
 *
 * Why: DATA-003 runs the purge on a configured date for the academic year that has ended. D-107 moves the default to
 *      31 August, so the 30 days after the year's end on 31 July always pass first, and refuses an earlier day; its
 *      amendment of 2026-11-04 also refuses January to July, which would keep a year's rows for most of another year.
 * Spec: DATA-003
 * Invariants:
 *   - SPEC-DEVIATION: D-107 — the default run date is 31 August, not 15 August, and no day before 31 August is accepted.
 *   - A run date is a day from 31 August to 31 December, written `MM-DD`; anything else is refused with a message that
 *     states the rule and never repeats the value.
 *   - Academic year Y's purge may run from midnight in Oslo on the run date in calendar year Y until the year ends.
 *   - The purge takes the years before the current one; the current year began at `cutoff`, which is also where the
 *     year that ended last ended (../academicYear.ts: 1 August, midnight in Oslo).
 *   - Nothing depends on the server's own time zone.
 * Collaborators: ../academicYear.ts, ../../insight/scope/insightPeriod.ts (`osloMidnight`), ./RetentionPurgeJob.ts,
 *   ./purgeCli.ts, ./retentionPurge.ts, ../../config/env.ts (`PURGE_RUN_DATE`).
 * Tests: apps/server/test/privacy/purge/purgeCalendar.test.ts
 */
import { osloMidnight } from '../../insight/scope/insightPeriod.js';
import { academicYearOf } from '../academicYear.js';

/** A day of the year on which the purge runs: from 31 August to 31 December. */
export interface PurgeRunDate {
  /** 8 to 12. */
  readonly month: number;
  /** A day the month has; 31 when the month is August. */
  readonly day: number;
}

/** The default run date, 31 August (D-107). */
export const DEFAULT_PURGE_RUN_DATE: PurgeRunDate = Object.freeze({ month: 8, day: 31 });

/** The month an academic year starts in (1 August). */
const YEAR_START_MONTH = 8;

/** The days of the months a run date may fall in. */
const DAYS_IN_MONTH: Readonly<Record<number, number>> = { 8: 31, 9: 30, 10: 31, 11: 30, 12: 31 };

/** The rule a refused run date breaks; a message, never the value. */
const RULE = 'must be a day from 08-31 to 12-31, written MM-DD (D-107)';

const isAllowed = (month: number, day: number): boolean => {
  const days = DAYS_IN_MONTH[month];
  // SPEC-DEVIATION: D-107 — no day before 31 August, so the 30 days after the year's end always pass first.
  return days !== undefined && day >= 1 && day <= days && (month !== YEAR_START_MONTH || day === 31);
};

/**
 * Reads a run date.
 * @param raw - `MM-DD`, e.g. `08-31` or `09-15`.
 * @returns The run date.
 * @throws RangeError when it is not a day from 31 August to 31 December.
 * @example
 * parsePurgeRunDate('09-15'); // { month: 9, day: 15 }
 * @spec DATA-003
 */
export function parsePurgeRunDate(raw: string): PurgeRunDate {
  const match = /^(\d{2})-(\d{2})$/.exec(raw.trim());
  const month = Number(match?.[1]);
  const day = Number(match?.[2]);
  if (!match || !isAllowed(month, day)) throw new RangeError(RULE);
  return Object.freeze({ month, day });
}

/** What a purge at one moment covers. */
export interface PurgeScope {
  /** The academic year the moment is in; none of its rows is ever selected. */
  readonly currentYear: number;
  /** The year that ended last (`currentYear − 1`), which the audit event names. */
  readonly endedYear: number;
  /** Where the current year began: learner identities and accounts created before it go. */
  readonly cutoff: Date;
}

/**
 * The start of an academic year.
 * @param year - The year, named by its first calendar year (2026 for 2026/27).
 * @returns Midnight in Oslo on 1 August of that year.
 * @spec DATA-003
 */
export const academicYearStart = (year: number): Date =>
  osloMidnight({ year, month: YEAR_START_MONTH, day: 1 });

/**
 * What a purge at a moment covers.
 * @param now - The moment of the run.
 * @returns The current and the ended year, and where the current year began.
 * @spec DATA-003
 */
export function purgeScopeAt(now: Date): PurgeScope {
  const currentYear = academicYearOf(now);
  return { currentYear, endedYear: currentYear - 1, cutoff: academicYearStart(currentYear) };
}

/**
 * When the purge of the year that ended before `now`'s academic year may first run.
 * @param runDate - The configured run date.
 * @param now - Any moment of the academic year.
 * @returns Midnight in Oslo on the run date in the calendar year the current academic year started in.
 * @throws RangeError for a run date `parsePurgeRunDate` would refuse.
 * @spec DATA-003
 */
export function purgeRunsFrom(runDate: PurgeRunDate, now: Date): Date {
  // WHY: a run date built by hand, not parsed, is checked too, so no caller can move the purge before 31 August.
  if (!isAllowed(runDate.month, runDate.day)) throw new RangeError(RULE);
  return osloMidnight({ year: academicYearOf(now), month: runDate.month, day: runDate.day });
}

/**
 * Tells whether the purge of the year that ended may run at a moment.
 * @param runDate - The configured run date.
 * @param now - The moment.
 * @returns True from midnight in Oslo on the run date until the academic year ends.
 * @spec DATA-003
 */
export const isPurgeDue = (runDate: PurgeRunDate, now: Date): boolean =>
  now.getTime() >= purgeRunsFrom(runDate, now).getTime();
