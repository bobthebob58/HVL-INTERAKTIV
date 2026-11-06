/**
 * runResults — answers, from the committed run summary, what the last full run of the accessibility suite found for
 * one check or one set of axe rules.
 *
 * Why: UD-040 gives each criterion the result of its checks. Asking the summary the same questions in one place
 *      keeps the criterion sections, the summary table and the appendix consistent with each other.
 * Spec: UD-040
 * Invariants:
 *   - A suite check's tests are those of its file whose printed title matches it (./testIndex.mjs `titleMatches`).
 *   - No summary means no result: every answer then says the run is not recorded, never that a check passed.
 *   - A file Vitest marked failed is said to have failed, also when its tests show only as skipped (a failed hook)
 *     or not at all (a failed import), and the run then did not pass.
 * Collaborators: ./runSummary.mjs, ./testIndex.mjs, ./renderCriterion.mjs, ./renderSections.mjs, ./a11yReport.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs, tools/a11y-report/test/runSummary.test.mjs
 */
import { titleMatches } from './testIndex.mjs';

/**
 * Counts the tests of a suite check by status in the last run.
 * @param {object | undefined} summary - The committed run summary.
 * @param {{suite: string, match: string[], contains?: string | string[]}} check - A suite check.
 * @returns {{passed: number, failed: number, skipped: number, fileFailed: boolean} | undefined} The counts and
 *   whether Vitest marked the file failed, or undefined without a run.
 */
export function suiteResult(summary, check) {
  if (!summary) return undefined;
  const tests = (summary.files[check.suite] ?? []).filter((t) => titleMatches(t.title, check));
  const count = (status) => tests.filter((t) => t.status === status).length;
  const fileFailed = summary.failedFiles.includes(check.suite);
  return { passed: count('passed'), failed: count('failed'), skipped: count('skipped'), fileFailed };
}

/**
 * Says a suite check's result in words.
 * @param {{passed: number, failed: number, skipped: number, fileFailed?: boolean} | undefined} result - From
 *   suiteResult.
 * @returns {string} For example `24 passed, 1 failed`.
 */
export function resultText(result) {
  if (!result) return 'not recorded (no full run yet)';
  const parts = ['passed', 'failed', 'skipped'].filter((s) => result[s] > 0).map((s) => `${result[s]} ${s}`);
  const counts = parts.length ? parts.join(', ') : 'no test of this check ran';
  return result.fileFailed ? `its file failed (appendix A); ${counts}` : counts;
}

/**
 * Whether a run passed: no failed test and no file Vitest marked failed.
 * @param {{totals: {failed: number, failedFiles: number}}} summary - From ./runSummary.mjs distilRun.
 * @returns {boolean} True when nothing failed.
 */
export const runPassed = (summary) => summary.totals.failed === 0 && summary.totals.failedFiles === 0;

/**
 * The suite files with running tests that a run left out: a run of one file or a filtered folder is not the full run.
 * @param {{files: Record<string, unknown>}} summary - From ./runSummary.mjs distilRun.
 * @param {string[]} suiteFiles - Paths under apps/server/a11y/ of the files that have running tests.
 * @returns {string[]} The files missing from the run, in the order given.
 */
export const missingSuiteFiles = (summary, suiteFiles) =>
  suiteFiles.filter((file) => !Object.hasOwn(summary.files, file));

/**
 * The axe findings of some rules in the last run.
 * @param {object | undefined} summary - The committed run summary.
 * @param {string[]} ruleIds - The rules.
 * @returns {{blocking: object[], other: object[], review: object[]} | undefined} Findings by kind, or undefined.
 */
export function axeFindings(summary, ruleIds) {
  if (!summary) return undefined;
  const pick = (list) => list.filter((f) => ruleIds.includes(f.rule));
  return {
    blocking: pick(summary.axe.blocking),
    other: pick(summary.axe.other),
    review: pick(summary.axe.review),
  };
}

/**
 * Says counted findings in words, e.g. `color-contrast (serious): 3 elements in 2 scans`.
 * @param {{rule: string, impact: string, elements: number, scans: number}[]} findings - Counted findings.
 * @returns {string} One phrase per rule and impact, joined by semicolons; `none` when empty.
 */
export const findingsText = (findings) =>
  findings.length === 0
    ? 'none'
    : findings
        .map(
          (f) =>
            `\`${f.rule}\` (${f.impact}): ${f.elements} element${f.elements === 1 ? '' : 's'} in ${f.scans}`,
        )
        .map((text, i) => `${text} scan${findings[i].scans === 1 ? '' : 's'}`)
        .join('; ');
