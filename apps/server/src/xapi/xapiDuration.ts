/**
 * xapiDuration — reads an xAPI `result.duration` (ISO 8601, as H5P writes it, e.g. `PT3.67S`) as whole milliseconds
 * for `XapiStatement.durationMs`.
 *
 * Why: DATA-012 lists `durationMs`, so it is stored, but probe P1 found that H5P's durations mean different things by
 *      type (summed across retries, reset by a retry, counted from pre-rendering), so no insight reads it (D-115). The
 *      value only has to be safe to store: absent, unreadable or implausible becomes null.
 * Spec: DATA-012
 * Invariants:
 *   - Only `P[nD][T[nH][nM][nS]]` with at least one component is read; weeks, years, months, signs and a bare `P` or
 *     `PT` are unreadable. Each number may have a decimal part.
 *   - A duration over 24 hours is null (D-115), which also keeps every stored value inside a 32-bit integer.
 *   - Milliseconds are rounded to the nearest whole one.
 * Collaborators: ./xapiStatementRow.ts.
 * Tests: apps/server/test/xapi/xapiStatementRow.test.ts
 */

/** The longest duration stored, in milliseconds (D-115). */
export const XAPI_DURATION_MAX_MS = 24 * 60 * 60 * 1000;

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const DURATION = new RegExp(`^P(?:${NUMBER}D)?(?:T(?:${NUMBER}H)?(?:${NUMBER}M)?(?:${NUMBER}S)?)?$`);
const UNIT_MS = [24 * 3_600_000, 3_600_000, 60_000, 1_000] as const;

/**
 * Reads an xAPI duration.
 * @param duration - `result.duration` as sent, if any.
 * @returns Whole milliseconds, or null when absent, unreadable or over 24 hours.
 * @spec DATA-012
 */
export function durationMsOf(duration: string | undefined): number | null {
  if (duration === undefined) return null;
  const match = DURATION.exec(duration);
  const parts = match ? match.slice(1) : [];
  // WHY: the pattern lets every component be absent, so `P` and `PT` match; neither is a duration.
  if (!match || parts.every((part) => part === undefined) || duration.endsWith('T')) return null;
  const ms = Math.round(parts.reduce((sum, part, i) => sum + Number(part ?? 0) * (UNIT_MS[i] ?? 0), 0));
  return ms > XAPI_DURATION_MAX_MS ? null : ms;
}
