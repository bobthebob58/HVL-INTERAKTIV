#!/usr/bin/env node
/**
 * a11yReport — `npm run a11y:report`: regenerates the automated parts of the WCAG 2.2 conformance report
 * (docs/accessibility/WCAG-CONFORMANCE-REPORT.md), keeping its manual blocks, optionally after recording a run.
 *
 * Why: UD-040 says `npm run a11y:report` regenerates the automated parts, and the S6 gate checks that it does so
 *      unchanged (D-113). The run enters through the committed summary (D-079 amendment of 2026-11-05), so `--check`
 *      works on a fresh checkout without Chromium.
 * Spec: UD-040, UD-030
 * Invariants:
 *   - Without flags it writes the report from the committed summary; with `--check` it writes nothing and exits 1
 *     when the committed report differs from what its sources give.
 *   - `--from-run=<dir>` records the run in <dir> (Vitest's `vitest.json` and `axe-reports.jsonl`) as the summary
 *     first; `--run` runs `npm run test:a11y` into a temporary folder and records that (it needs `npm run build`
 *     and the services). A failed suite (a failed test, or a file whose hook or import failed) is still recorded,
 *     and the command then exits 1. A run that lacks a suite file with running tests is refused, writing nothing.
 *   - The summary takes the commit from `git rev-parse HEAD`; the tree is "clean" only when `git status --porcelain`
 *     shows nothing, untracked files included (D-079 amendment of the S6 step 6 review).
 *   - It prints only paths and counts: no personal data, no tokens.
 * Collaborators: ./buildReport.mjs, ./runSummary.mjs, ./runResults.mjs, ./testIndex.mjs, ./axeRuleIndex.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs (the generator), tools/a11y-report/test/runSummary.test.mjs.
 * Usage:
 *   npm run a11y:report                         rewrite the report from the committed summary
 *   npm run a11y:report -- --check              fail when the committed report is stale
 *   npm run a11y:report -- --from-run=<dir>     record the run in <dir>, then rewrite
 *   npm run a11y:report -- --run                run the suite, record it, then rewrite
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { committedReport, generateReport } from './buildReport.mjs';
import { loadAxe } from './axeRuleIndex.mjs';
import { REPORT_PATH } from './renderReport.mjs';
import { missingSuiteFiles, runPassed } from './runResults.mjs';
import { SUMMARY_PATH, VITEST_JSON, distilRun, readRunFolder, writeSummary } from './runSummary.mjs';
import { SUITE_DIR, indexTests } from './testIndex.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Where a run came from: the checked-out commit and whether any file, tracked or not, differs from it.
 * @param {string} root - Repository root.
 * @returns {{commit: string, clean: boolean, axeVersion: string}} For distilRun.
 */
function runSource(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  return {
    commit: git('rev-parse', 'HEAD'),
    // WHY: an untracked test or source file changes what ran as much as an edited one does.
    clean: git('status', '--porcelain') === '',
    axeVersion: loadAxe(root).version,
  };
}

/**
 * Distils a run folder, refusing a run that is not the whole suite.
 * @param {string} root - Repository root.
 * @param {string} dir - The run folder.
 * @returns {object} The summary, not yet written.
 * @throws Error when a suite file with running tests is missing from the run.
 */
function recordedRun(root, dir) {
  const { vitest, axeReports } = readRunFolder(dir);
  const summary = distilRun(vitest, axeReports, runSource(root));
  const suiteFiles = indexTests(root)
    .map((f) => f.file)
    .filter((file) => file.startsWith(`${SUITE_DIR}/`))
    .map((file) => file.slice(SUITE_DIR.length + 1));
  const missing = missingSuiteFiles(summary, suiteFiles);
  if (missing.length)
    throw new Error(`the run is not the full suite; it lacks ${missing.join(', ')}. Nothing was written`);
  return summary;
}

/**
 * Runs the accessibility suite into a temporary folder.
 * @param {string} root - Repository root.
 * @returns {{dir: string, ok: boolean}} The folder and whether the suite passed.
 */
function runSuite(root) {
  const dir = mkdtempSync(join(tmpdir(), 'hvli-a11y-run-'));
  const args = [
    'run',
    'test:a11y',
    '--',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${join(dir, VITEST_JSON)}`,
  ];
  const result = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, A11Y_REPORT_DIR: dir },
  });
  return { dir, ok: result.status === 0 };
}

/**
 * Runs the command.
 * @param {string[]} argv - The arguments after the script.
 * @returns {Promise<number>} The exit code.
 */
async function main(argv) {
  const check = argv.includes('--check');
  const run = argv.includes('--run');
  const fromRun = argv.find((a) => a.startsWith('--from-run='))?.slice('--from-run='.length);
  if (check && (run || fromRun))
    throw new Error('--check reads the committed summary; it cannot record a run');
  let ok = true;
  if (run || fromRun) {
    const suite = run ? runSuite(ROOT) : { dir: fromRun, ok: true };
    try {
      const summary = recordedRun(ROOT, suite.dir);
      writeSummary(ROOT, summary);
      ok = suite.ok && runPassed(summary);
    } finally {
      if (run) rmSync(suite.dir, { recursive: true, force: true });
    }
    console.info(`a11y:report: recorded the run in ${SUMMARY_PATH}${ok ? '' : ' (the run failed)'}`);
  }
  const report = await generateReport(ROOT);
  if (check) {
    if (report === committedReport(ROOT)) return 0;
    console.error(`a11y:report: ${REPORT_PATH} is not what its sources give. Run: npm run a11y:report`);
    return 1;
  }
  writeFileSync(join(ROOT, REPORT_PATH), report);
  console.info(`a11y:report: wrote ${REPORT_PATH}`);
  return ok ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(`a11y:report: ${error.message}`);
    process.exit(1);
  },
);
