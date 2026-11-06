/**
 * resultSemesters — the semesters the pedagogisk mappe groups stored results by: each starts at midnight Oslo time on
 * 1 January or 1 August, as insight's `semester` period does, and the windows that cover a span of stored statements.
 *
 * Why: the mappe shows one set of figures per activity over all its courses, versions and semesters, while insight
 *      shows one course and one version for at most the current semester (D-106). So that no group insight
 *      suppresses can be worked out by subtracting its views from the mappe's totals, the mappe counts only groups of
 *      at least *k* learners per course, version and semester (./learnerSummaries.ts). The cut is insight's own,
 *      built from its Oslo date functions, so a mappe group and an insight `semester` view always begin alike.
 * Spec: MAPPE-003, INS-006
 * Invariants:
 *   - A semester starts at midnight Oslo time on 1 August (for August to December) or on 1 January (otherwise), the
 *     rule of ../../insight/scope/insightPeriod.ts (D-106: until HVL gives its semester dates), and ends where the
 *     next one starts.
 *   - `semesterWindows(first, last)` lists the semesters from the one holding `first` to the one holding `last`, in
 *     order, each ending where the next starts, so every moment between them is in exactly one window.
 * Collaborators: ../../insight/scope/insightPeriod.ts (`osloDateOf`, `osloMidnight`), ./learnerSummaries.ts,
 *   ./storedActivityResults.ts.
 * Tests: apps/server/test/learningDesign/mappe/resultSemesters.test.ts
 */
import { osloDateOf, osloMidnight } from '../../insight/scope/insightPeriod.js';

/** The month the autumn semester starts in; the spring semester starts in January. */
const AUTUMN_MONTH = 8;

/** One semester: from `start` (inclusive) to `end` (exclusive). */
export interface SemesterWindow {
  /** Midnight Oslo time on 1 January or 1 August. */
  readonly start: Date;
  /** The next semester's start. */
  readonly end: Date;
}

/**
 * The start of the semester a moment falls in.
 * @param at - The moment.
 * @returns Midnight Oslo time on 1 August from August to December, else on 1 January, of the moment's Oslo year.
 * @spec MAPPE-003
 */
export function semesterStartOf(at: Date): Date {
  const { year, month } = osloDateOf(at);
  return osloMidnight({ year, month: month >= AUTUMN_MONTH ? AUTUMN_MONTH : 1, day: 1 });
}

/**
 * The semesters that cover a span of moments.
 * @param first - The earliest moment.
 * @param last - The latest moment, not before `first`.
 * @returns The semesters from the one holding `first` to the one holding `last`, in order.
 * @example
 * semesterWindows(new Date('2026-05-02T10:00Z'), new Date('2026-09-01T10:00Z'));
 * // spring 2026 (from 2025-12-31T23:00Z) and autumn 2026 (from 2026-07-31T22:00Z)
 * @spec MAPPE-003
 */
export function semesterWindows(first: Date, last: Date): SemesterWindow[] {
  const windows: SemesterWindow[] = [];
  for (let start = semesterStartOf(first); start.getTime() <= last.getTime();) {
    const { year, month } = osloDateOf(start);
    const end = osloMidnight(
      month === AUTUMN_MONTH ? { year: year + 1, month: 1, day: 1 } : { year, month: AUTUMN_MONTH, day: 1 },
    );
    windows.push({ start, end });
    start = end;
  }
  return windows;
}
