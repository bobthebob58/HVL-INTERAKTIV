/**
 * auditExceptionRules — what an entry of audit-exceptions.json must hold before it can cover an advisory.
 *
 * Why: an exception lets a known advisory through the audit check, so it must say what it covers, why, and until
 *      when. Compared as text, a missing or misspelt expiry date never came before "today", and a date years ahead
 *      was taken as written, so an exception could outlive every review (SEC-007: "a reviewed exception must be
 *      recorded ... with an expiry date"; D-145).
 * Spec: SEC-007
 * Invariants:
 *   - An entry is an object with `advisory`, `package`, `decision`, `expires` and `mitigation`, each a text that is
 *     not empty; `advisory` is an ID as the audit check forms it and `decision` has the form `D-123`.
 *   - `expires` is a real calendar date (`YYYY-MM-DD`; 2027-02-30 is not one) and lies at most
 *     `MAX_EXCEPTION_DAYS` after today, so every exception is read again within that time.
 *   - No two entries cover the same advisory for the same package.
 *   - Pure: the function returns problems as text and an empty list when all is well.
 * Collaborators: ./checkAudit.mjs (calls it before it matches advisories), ./audit-exceptions.json.
 * Tests: tools/dependency-check/test/auditExceptionRules.test.mjs
 */

/** The longest time, in days, an exception may run from today before a person reads it again. */
export const MAX_EXCEPTION_DAYS = 120;

const DAY_MS = 86_400_000;
const FIELDS = ['advisory', 'package', 'decision', 'expires', 'mitigation'];
const ADVISORY_ID = /^(GHSA(-[0-9a-z]{4}){3}|npm-\d+)$/;
const DECISION_ID = /^D-\d{3}$/;

const isText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Tells whether a value is a real calendar date written as `YYYY-MM-DD`.
 * @param {unknown} value - The value of an `expires` field.
 * @returns {boolean} True for a date that exists.
 */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // WHY: Date accepts 2027-02-30 and moves it to March; a date that exists comes back as it was written.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Counts the days from one calendar date to another.
 * @param {string} from - A calendar date (`YYYY-MM-DD`).
 * @param {string} to - A calendar date (`YYYY-MM-DD`).
 * @returns {number} Days from `from` to `to`; negative when `to` is earlier.
 */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Checks the exception list itself, before any advisory is matched against it.
 * @param {unknown} exceptions - The parsed audit-exceptions.json.
 * @param {string} today - ISO date (`YYYY-MM-DD`).
 * @returns {string[]} Problems; empty when every entry is complete, dated and single.
 */
export function exceptionProblems(exceptions, today) {
  if (!Array.isArray(exceptions)) return ['audit-exceptions.json: must be a list of exceptions'];
  const problems = [];
  const seen = new Set();
  exceptions.forEach((entry, index) => {
    const place = `audit-exceptions.json, entry ${index + 1}`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${place}: must be an object`);
      return;
    }
    const name = isText(entry.advisory) ? `${place} (${entry.advisory})` : place;
    for (const field of FIELDS) if (!isText(entry[field])) problems.push(`${name}: needs ${field}`);
    if (isText(entry.advisory) && !ADVISORY_ID.test(entry.advisory))
      problems.push(`${name}: advisory is not an advisory ID (GHSA-xxxx-xxxx-xxxx)`);
    if (isText(entry.decision) && !DECISION_ID.test(entry.decision))
      problems.push(`${name}: decision "${entry.decision}" is not a decision ID (D-123)`);
    if (isText(entry.expires)) {
      if (!isCalendarDate(entry.expires))
        problems.push(`${name}: expires "${entry.expires}" is not a calendar date (YYYY-MM-DD)`);
      else if (daysBetween(today, entry.expires) > MAX_EXCEPTION_DAYS)
        problems.push(
          `${name}: expires ${entry.expires} is more than ${MAX_EXCEPTION_DAYS} days ahead; review it sooner`,
        );
    }
    const key = `${entry.advisory} ${entry.package}`;
    if (seen.has(key)) problems.push(`${name}: a second exception for ${entry.package}`);
    seen.add(key);
  });
  return problems;
}
