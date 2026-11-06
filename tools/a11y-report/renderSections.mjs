/**
 * renderSections — writes the report's sections that span criteria: the summary table, the list of dated manual
 * results, the register of H5P upstream barriers and the appendix of the last automated run.
 *
 * Why: UD-040's report is the input for HVL's uustatus.no statement, which needs the verdicts at a glance, the
 *      dated evidence, and the upstream limitations with their links in one place. Each section is a pure function
 *      of the committed sources, so a regeneration of an unchanged tree gives the same text.
 * Spec: UD-040, UD-031, UD-030
 * Invariants:
 *   - The summary copies each verdict from its manual block (./manualBlocks.mjs `verdictOf`); none is computed.
 *   - Dates come only from the inputs: result file names and the run summary.
 *   - Output depends only on its inputs: no clock, no environment, no file system.
 * Collaborators: ./renderReport.mjs, ./renderCriterion.mjs, ./runResults.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { fileLink, plain } from './renderCriterion.mjs';
import { criterionBlockId, VERDICTS, verdictOf } from './manualBlocks.mjs';
import { issueText } from './upstreamEntries.mjs';

const cell = (text) => plain(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * GitHub's anchor for a heading, e.g. `1.4.10 Reflow` → `1410-reflow`.
 * @param {string} heading - The heading text.
 * @returns {string} The anchor without `#`.
 */
export const anchorOf = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/ /g, '-');

/**
 * The summary table: one row per criterion with its verdict as people wrote it.
 * @param {{id: string, name: string, level: string}[]} criteria - In report order.
 * @param {Map<string, string>} blocks - The manual blocks.
 * @param {Record<string, {checks: object[], protocol: string[]}>} evidence - The evidence map.
 * @param {(id: string) => number} axeRuleCount - How many axe rules run for a criterion.
 * @param {(id: string) => number} protocolCount - How many protocol steps and page checks name it.
 * @returns {string} The table and the count of verdicts.
 */
export function summaryTable(criteria, blocks, evidence, axeRuleCount, protocolCount) {
  const verdicts = new Map(VERDICTS.map((v) => [v, 0]));
  const rows = criteria.map((c) => {
    const id = criterionBlockId(c.id);
    const verdict = verdictOf(id, blocks.get(id));
    verdicts.set(verdict, verdicts.get(verdict) + 1);
    const { checks } = evidence[c.id];
    const suite = checks.filter((k) => k.suite).length;
    const automated = [
      axeRuleCount(c.id) ? `axe: ${axeRuleCount(c.id)}` : '',
      suite ? `suite: ${suite}` : '',
      checks.length - suite ? `tests: ${checks.length - suite}` : '',
    ].filter(Boolean);
    const heading = `${c.id} ${c.name}`;
    return `| [${cell(heading)}](#${anchorOf(heading)}) | ${c.level} | ${verdict} | ${automated.join(', ') || 'none'} | ${protocolCount(c.id)} |`;
  });
  return [
    '| Criterion | Level | Verdict (HVL) | Automated checks | Protocol steps and checks |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `Verdicts: ${[...verdicts].map(([v, n]) => `${v} ${n}`).join(' · ')}.`,
  ].join('\n');
}

/**
 * The dated manual results, as UD-031 keeps them.
 * @param {{file: string, date?: string, release?: string, setUp?: string}[]} files - From resultFiles.
 * @returns {string} A table, or the statement that none is recorded.
 */
export function resultsList(files) {
  if (files.length === 0)
    return (
      'No manual run is recorded in [results/](results/README.md) yet: the assistive-technology protocol is ' +
      '*not yet tested by HVL*.'
    );
  const rows = files.map(
    (f) =>
      `| ${f.date ?? '—'} | ${cell(f.release ?? '—')} | ${cell(f.setUp ?? '—')} | [${cell(f.file)}](results/${f.file}) |`,
  );
  return ['| Date | Release | Set-up | Result file |', '|---|---|---|---|', ...rows].join('\n');
}

/**
 * The register of H5P upstream barriers in full.
 * @param {{findings: object[], englishTexts: object[]}} register - From ./upstreamEntries.mjs.
 * @param {(ruleId: string) => string[]} criteriaOfRule - The criteria axe tags a rule with.
 * @returns {string} Two tables.
 */
export function registerTables(register, criteriaOfRule) {
  const findings = register.findings.map(
    (f) =>
      `| \`${f.ruleId}\` | ${criteriaOfRule(f.ruleId).join(', ')} | ${f.surfaces.join(', ')} | ${cell(f.types.map((t) => (t === '*' ? 'every content type' : t)).join(', '))} | ${cell(f.why)} | <${f.source}> | ${issueText(f)} |`,
  );
  const texts = register.englishTexts.map(
    (t) =>
      `| ${t.library} | «${cell(t.text)}» | ${cell(t.shownWhen)} | ${cell(t.why)} | <${t.source}> | ${issueText(t)} |`,
  );
  return [
    'Serious and critical axe findings in H5P’s own markup that the theme and the run-time repairs (D-080) cannot ' +
      `remove (${fileLink('apps/server/a11y/support/upstreamRegister.ts')}). Each is reported in every run; an entry ` +
      'that stops occurring fails the suite, so this list is current at the run below.',
    '',
    '| axe rule | Criteria | Where | Content types | Why it fails and why we cannot repair it | Source at the pinned commit | Issue |',
    '|---|---|---|---|---|---|---|',
    ...findings,
    '',
    'Texts a pinned library writes in English whatever the activity’s language, which axe cannot see (3.1.2):',
    '',
    '| Library | Text | Shown when | Why | Source | Issue |',
    '|---|---|---|---|---|---|',
    ...texts,
  ].join('\n');
}

/**
 * The appendix of the last automated run.
 * @param {object | undefined} summary - The committed run summary.
 * @returns {string} Totals, the tests by file, failures by title and the axe findings by rule.
 */
export function runAppendix(summary) {
  if (!summary) return 'No full run is recorded yet (`npm run a11y:report -- --run`).';
  const files = Object.entries(summary.files).map(([file, tests]) => {
    const n = (s) => tests.filter((t) => t.status === s).length;
    const state = summary.failedFiles.includes(file) ? 'failed' : 'passed';
    return `| ${fileLink(`apps/server/a11y/${file}`)} | ${state} | ${n('passed')} | ${n('failed')} | ${n('skipped')} |`;
  });
  // WHY: Vitest marks a file failed when a hook or its import failed; its tests then show as skipped or not at all.
  const failedFiles = summary.failedFiles.length
    ? summary.failedFiles.map((f) => `\`${f}\``).join(', ')
    : 'none';
  const failed = Object.entries(summary.files).flatMap(([file, tests]) =>
    tests
      .filter((t) => t.status === 'failed')
      .map((t) => `- \`${file}\`: ${plain(t.group ? `${t.group} › ${t.title}` : t.title)}`),
  );
  const table = (rows) =>
    rows.length === 0
      ? 'None.'
      : [
          '| Rule | Impact | Elements | Scans |',
          '|---|---|---|---|',
          ...rows.map((f) => `| \`${f.rule}\` | ${f.impact} | ${f.elements} | ${f.scans} |`),
        ].join('\n');
  const t = summary.totals;
  return [
    `\`${summary.command}\` on ${summary.date}, commit \`${summary.commit.slice(0, 12)}\` (${summary.worktree}), ` +
      `axe-core ${summary.axeCore}: ${t.files} files, ${t.failedFiles} of them failed; ${t.passed} tests passed, ` +
      `${t.failed} failed, ${t.skipped} skipped.`,
    '',
    '| Suite file | File | Passed | Failed | Skipped |',
    '|---|---|---|---|---|',
    ...files,
    '',
    `Files Vitest marked failed (a failed test, or a hook or an import that failed, which leaves the file’s tests ` +
      `skipped or unlisted): ${failedFiles}.`,
    '',
    `Failed tests: ${failed.length ? `\n\n${failed.join('\n')}` : 'none.'}`,
    '',
    `axe scanned ${summary.axe.scans} times (appendix B). Serious and critical findings (the suite fails on any that the register does not list):`,
    '',
    table(summary.axe.blocking),
    '',
    'Lower-impact findings (`minor`, `moderate`; listed, not failing, as UD-030 says):',
    '',
    table(summary.axe.other),
    '',
    'Left to review by hand (axe’s *incomplete* results, e.g. contrast over a gradient):',
    '',
    table(summary.axe.review),
  ].join('\n');
}

/**
 * The views axe scanned, by the labels the suites print.
 * @param {object | undefined} summary - The committed run summary.
 * @returns {string} One line per label with its number of scans.
 */
export const scannedViews = (summary) =>
  summary
    ? summary.axe.labels
        .map((l) => `- ${plain(l.label)}${l.scans > 1 ? ` (${l.scans} scans)` : ''}`)
        .join('\n')
    : 'None recorded.';
