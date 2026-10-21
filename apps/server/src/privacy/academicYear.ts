/**
 * academicYear — which academic year a moment belongs to, by Norwegian time.
 *
 * Why: pseudonym secrets rotate per academic year (DATA-002) and the yearly purge deletes a whole
 *      year (DATA-003). Both need one shared rule for where the year boundary lies.
 * Spec: DATA-002
 * Invariants:
 *   - An academic year starts on 1 August at 00:00 in Europe/Oslo and is named by its starting
 *     calendar year: 2026 means 1 Aug 2026 to 31 Jul 2027.
 *   - The result does not depend on the server's own time zone.
 * Collaborators: ./deriveLearnerKey.ts.
 * Tests: apps/server/test/privacy/deriveLearnerKey.test.ts
 */

/** The time zone that defines the academic calendar. */
export const ACADEMIC_TIME_ZONE = 'Europe/Oslo';

const osloDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: ACADEMIC_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
});

/**
 * Returns the academic year a moment belongs to.
 * @param at - The moment; defaults to now.
 * @returns The starting calendar year, e.g. 2026 for any moment from 1 Aug 2026 00:00 Oslo time.
 */
export function academicYearOf(at: Date = new Date()): number {
  const parts = Object.fromEntries(osloDate.formatToParts(at).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  return month >= 8 ? year : year - 1;
}
