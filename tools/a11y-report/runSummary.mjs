/**
 * runSummary — distils one full run of the accessibility suite (Vitest's JSON report and the axe JSON lines of
 * `A11Y_REPORT_DIR`) into the small, committed summary the conformance report is generated from.
 *
 * Why: UD-040 regenerates the automated parts of the report, and the gate asks that a regeneration of an unchanged
 *      tree gives the same file (D-113, D-079 amendment of 2026-11-05). Raw run outputs hold durations, element
 *      markup and orders that change from run to run, and a fresh checkout has none, so the report reads this
 *      summary instead: titles and statuses, and axe findings counted by rule and impact.
 * Spec: UD-040, UD-030
 * Invariants:
 *   - The summary holds no duration, no element markup and no time but the run's date (UTC) and its commit.
 *   - Test titles are kept as the run printed them, with the titles of their describe blocks (`group`, which tells
 *     the light and forced-colours runs of one test apart); UUIDs become `<id>`, so two runs of the same tree give
 *     the same summary.
 *   - Files, tests, labels and findings are sorted, one per line, and the file ends with one newline.
 *   - A test that did not run (skipped, todo, pending) counts as `skipped`; it never counts as passed.
 *   - Files are keyed by their path under apps/server/a11y/. A file Vitest marks failed is in `failedFiles`, also
 *     when none of its tests failed: a failed hook leaves its tests `skipped`, a failed import leaves none (D-079
 *     amendment of the S6 step 6 review).
 *   - A run that lacks a suite file with running tests is not the full run (./runResults.mjs `missingSuiteFiles`).
 * Collaborators: ./runResults.mjs, ./a11yReport.mjs; apps/server/a11y/support/axeScan.ts writes the axe lines.
 * Tests: tools/a11y-report/test/runSummary.test.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The committed summary, relative to the repository root. */
export const SUMMARY_PATH = 'docs/accessibility/automated-run.json';
/** The Vitest JSON report inside a run folder. */
export const VITEST_JSON = 'vitest.json';
/** The axe JSON lines inside a run folder (`A11Y_REPORT_DIR`). */
export const AXE_LINES = 'axe-reports.jsonl';
/** The summary format this tool writes and reads. */
export const SUMMARY_FORMAT = 2;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const STATUSES = new Set(['passed', 'failed']);
const SUITE_PATH = '/apps/server/a11y/';

/**
 * A suite file's key: its path under apps/server/a11y/, so two files of one name in two folders stay apart.
 * @param {string} name - The path Vitest reports.
 * @returns {string} E.g. `keyboardFocus.a11y.test.ts`.
 * @throws Error for a file outside the accessibility suite.
 */
export function suiteKey(name) {
  const path = name.replace(/\\/g, '/');
  const at = path.lastIndexOf(SUITE_PATH);
  if (at < 0) throw new Error(`${name} is not a file of the accessibility suite (apps/server/a11y/)`);
  return path.slice(at + SUITE_PATH.length);
}

/**
 * Replaces the IDs a run makes up with `<id>`.
 * @param {string} text - A title or label as the run printed it.
 * @returns {string} The same text without them.
 */
export const stableText = (text) => text.replace(UUID, '<id>').replace(/\s+/g, ' ').trim();

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Counts axe findings of one kind by rule and impact.
 * @param {object[]} reports - The axe reports of the run.
 * @param {'blocking' | 'other' | 'review'} kind - Which list of each report.
 * @returns {{rule: string, impact: string, elements: number, scans: number}[]} Sorted by rule, then impact.
 */
function countFindings(reports, kind) {
  const counts = new Map();
  for (const report of reports) {
    const seen = new Set();
    for (const f of report[kind] ?? []) {
      const key = `${f.ruleId}\u0000${f.impact}`;
      const entry = counts.get(key) ?? { rule: f.ruleId, impact: f.impact, elements: 0, scans: 0 };
      entry.elements += 1;
      if (!seen.has(key)) {
        entry.scans += 1;
        seen.add(key);
      }
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => byText(a.rule, b.rule) || byText(a.impact, b.impact));
}

/**
 * Distils a run.
 * @param {{testResults: {name: string, status?: string, assertionResults: {ancestorTitles?: string[], title: string,
 *   status: string}[]}[], startTime?: number}} vitest - Vitest's JSON report.
 * @param {object[]} axeReports - One parsed line of `axe-reports.jsonl` per scan.
 * @param {{commit: string, clean: boolean, axeVersion: string}} source - Where the run came from.
 * @returns {object} The summary.
 * @throws Error when two results name the same suite file, or one is outside the suite.
 */
export function distilRun(vitest, axeReports, source) {
  const files = {};
  const failedFiles = [];
  for (const result of [...vitest.testResults].sort((a, b) => byText(suiteKey(a.name), suiteKey(b.name)))) {
    const key = suiteKey(result.name);
    if (files[key]) throw new Error(`the run reports ${key} twice`);
    if (result.status === 'failed') failedFiles.push(key);
    files[key] = result.assertionResults
      .map((a) => ({
        group: stableText((a.ancestorTitles ?? []).join(' › ')),
        title: stableText(a.title),
        status: STATUSES.has(a.status) ? a.status : 'skipped',
      }))
      .sort((a, b) => byText(a.group, b.group) || byText(a.title, b.title) || byText(a.status, b.status));
  }
  const tests = Object.values(files).flat();
  const count = (status) => tests.filter((t) => t.status === status).length;
  const labels = new Map();
  for (const r of axeReports) labels.set(stableText(r.label), (labels.get(stableText(r.label)) ?? 0) + 1);
  return {
    format: SUMMARY_FORMAT,
    command: 'npm run test:a11y',
    date: new Date(vitest.startTime ?? Date.now()).toISOString().slice(0, 10),
    commit: source.commit,
    worktree: source.clean ? 'clean' : 'with uncommitted changes',
    axeCore: source.axeVersion,
    totals: {
      files: Object.keys(files).length,
      failedFiles: failedFiles.length,
      passed: count('passed'),
      failed: count('failed'),
      skipped: count('skipped'),
    },
    failedFiles,
    files,
    axe: {
      scans: axeReports.length,
      labels: [...labels].sort(([a], [b]) => byText(a, b)).map(([label, scans]) => ({ label, scans })),
      blocking: countFindings(axeReports, 'blocking'),
      other: countFindings(axeReports, 'other'),
      review: countFindings(axeReports, 'review'),
    },
  };
}

/**
 * Reads a run folder: the Vitest JSON report and the axe lines.
 * @param {string} dir - The folder.
 * @returns {{vitest: object, axeReports: object[]}} Its contents.
 * @throws Error when the Vitest report is missing, so a partial run is never taken for a whole one.
 */
export function readRunFolder(dir) {
  const report = join(dir, VITEST_JSON);
  if (!existsSync(report)) throw new Error(`${report} is missing: run the suite with --reporter=json`);
  const lines = join(dir, AXE_LINES);
  const axeReports = existsSync(lines)
    ? readFileSync(lines, 'utf8')
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : [];
  return { vitest: JSON.parse(readFileSync(report, 'utf8')), axeReports };
}

/**
 * Serialises a summary the way it is committed: two-space JSON, with each test, label and finding on one line so a
 * new run shows in a diff as the lines that changed.
 * @param {object} summary - From distilRun.
 * @returns {string} The JSON with one final newline.
 */
export const summaryText = (summary) =>
  `${JSON.stringify(summary, null, 2).replace(/\{\n\s+"(?:group|label|rule)"[^{}]*?\n\s+\}/g, (entry) =>
    JSON.stringify(JSON.parse(entry)),
  )}\n`;

/**
 * Reads the committed summary.
 * @param {string} root - Repository root.
 * @returns {object | undefined} The summary, or undefined before the first run is recorded.
 * @throws Error for a summary of another format, which would be read wrongly (e.g. without its failed files).
 */
export function readSummary(root) {
  const file = join(root, SUMMARY_PATH);
  if (!existsSync(file)) return undefined;
  const summary = JSON.parse(readFileSync(file, 'utf8'));
  if (summary.format !== SUMMARY_FORMAT)
    throw new Error(
      `${SUMMARY_PATH} has format ${summary.format}, not ${SUMMARY_FORMAT}: record the run again`,
    );
  return summary;
}

/**
 * Writes the committed summary.
 * @param {string} root - Repository root.
 * @param {object} summary - From distilRun.
 */
export const writeSummary = (root, summary) => writeFileSync(join(root, SUMMARY_PATH), summaryText(summary));
