/**
 * renderReport — puts the WCAG 2.2 conformance report together: the introduction, the manual sections, the summary,
 * one section per success criterion grouped by principle, the register of H5P upstream barriers and the appendices.
 *
 * Why: UD-040 is the input HVL needs for its uustatus.no statement. The order is fixed so that people find their
 *      manual blocks in the same place after every regeneration, and so that two regenerations of the same sources
 *      give the same bytes.
 * Spec: UD-040, UD-031
 * Invariants:
 *   - Output depends only on its inputs; the only date in it is the run's own (from the summary).
 *   - Every criterion of ./wcagCriteria.mjs appears once, as a `###` heading, under its principle.
 *   - The text outside manual blocks never contains the marker syntax, so it cannot be mistaken for a block.
 *   - The file ends with exactly one newline.
 * Collaborators: ./renderCriterion.mjs, ./renderSections.mjs, ./manualBlocks.mjs, ./a11yReport.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { rulesOfCriterion } from './axeRuleIndex.mjs';
import { manualBlock } from './manualBlocks.mjs';
import { protocolRefs, renderCriterion } from './renderCriterion.mjs';
import { registerTables, resultsList, runAppendix, scannedViews, summaryTable } from './renderSections.mjs';
import { PRINCIPLES } from './wcagCriteria.mjs';

/** The report, relative to the repository root (the path UD-040 names). */
export const REPORT_PATH = 'docs/accessibility/WCAG-CONFORMANCE-REPORT.md';

/** The general manual sections, in report order. */
export const SECTION_BLOCKS = [
  'scope',
  'assistive-technology',
  'cognitive-review',
  'barriers-axe-cannot-see',
  'uustatus-notes',
];

const INTRO = [
  '# WCAG 2.2 conformance report',
  '',
  '> Requirement `UD-040` (spec 03 §6): every WCAG 2.2 Level A and AA success criterion with HVL’s verdict, the ' +
    'evidence and the known H5P upstream limitations, as the input for HVL’s accessibility statement on ' +
    'uustatus.no. Decision D-079 and its amendment for `UD-040`.',
  '',
  '**How this file is made.** `npm run a11y:report` writes it from the committed summary of the last full run of ' +
    'the accessibility suite ([automated-run.json](automated-run.json)), the evidence map in ' +
    '[`tools/a11y-report/`](../../tools/a11y-report/README.md), axe-core’s rule tags, the ' +
    '[manual test protocol](manual-test-protocol.md), the [results folder](results/README.md) and the register of ' +
    'H5P upstream barriers. **Only the blocks marked as manual are written by people**, between the HTML comments ' +
    '`manual:start` and `manual:end` that carry the block’s name: the generator copies them unchanged and rewrites ' +
    'everything else, so edit nothing outside them. After a full run, `npm run a11y:report -- --from-run=<folder>` ' +
    '(or `npm run a11y:report -- --run`) records it; `npm run a11y:report -- --check` fails when this file differs ' +
    'from what its sources give.',
  '',
  '**What the automated part can and cannot show.** axe and our browser checks find only part of the barriers ' +
    '(protocol §1). They show where a criterion is checked and what the last run found; they never decide a ' +
    'verdict. A verdict is HVL’s, written in the criterion’s manual block, and the summary copies it.',
  '',
  '**What a criterion’s manual block holds.** The line `**Verdict:**` with one of *Supports*, *Partially ' +
    'supports*, *Does not support*, *Not applicable* or *Not yet determined*; under *Evaluated by HVL* the date, the ' +
    'evaluator’s role and initials and the result files (as [results/README.md](results/README.md) names them); and ' +
    'the manual evidence and remarks. *Not yet tested by HVL* stays until HVL has evaluated the criterion.',
];

/**
 * A manual section: its heading, any generated lead-in, and its block.
 * @param {string} heading - The `##` heading.
 * @param {string} id - The block ID.
 * @param {Map<string, string>} blocks - The manual blocks.
 * @param {string} [lead] - Generated text above the block.
 * @returns {string[]} The lines.
 */
const manualSection = (heading, id, blocks, lead) => [
  `## ${heading}`,
  '',
  ...(lead ? [lead, ''] : []),
  manualBlock(id, blocks.get(id)),
  '',
];

/**
 * Writes the whole report.
 * @param {{criteria: object[], evidence: object, axeIndex: object, index: object[], summary: object | undefined,
 *   protocol: object, register: object, results: object[], blocks: Map<string, string>}} ctx - Its sources.
 * @returns {string} The report's Markdown.
 */
export function renderReport(ctx) {
  const { criteria, summary, blocks } = ctx;
  const ruleCount = (id) => rulesOfCriterion(ctx.axeIndex, id).running.length;
  const protocolCount = (id) => protocolRefs(ctx.evidence[id], ctx.protocol, id).length;
  const failedFiles = summary?.totals.failedFiles
    ? `; ${summary.totals.failedFiles} of ${summary.totals.files} files failed`
    : '';
  const run = summary
    ? `${summary.date}, commit \`${summary.commit.slice(0, 12)}\` (${summary.worktree}): ${summary.totals.passed} ` +
      `passed, ${summary.totals.failed} failed, ${summary.totals.skipped} skipped${failedFiles} (appendix A)`
    : 'none recorded yet';
  const manual = ctx.results.length
    ? `${ctx.results.length} result files (§3)`
    : 'none recorded yet (*not yet tested by HVL*)';
  const principles = Object.entries(PRINCIPLES).flatMap(([digit, name], i) => [
    `## ${6 + i}. ${name}`,
    '',
    ...criteria
      .filter((c) => c.id.startsWith(`${digit}.`))
      .flatMap((c) => [renderCriterion(c, ctx.evidence[c.id], ctx), '']),
  ]);
  const criteriaOfRule = (ruleId) => ctx.axeIndex.rules.find((r) => r.id === ruleId)?.criteria ?? [];
  const lines = [
    ...INTRO,
    '',
    '| | |',
    '|---|---|',
    '| Product | HVL Interaktiv: the web app, the server-rendered pages, the Canvas views and the ten H5P content types with the HVL theme |',
    `| Standard | WCAG 2.2, Level A and AA: ${criteria.length} success criteria (4.1.1 *Parsing* included for WCAG 2.1 and EN 301 549) |`,
    `| Last automated run | ${run} |`,
    `| Manual results | ${manual} |`,
    `| Automated tools | axe-core ${ctx.axeIndex.version} with the tags ${ctx.axeIndex.tags.map((t) => `\`${t}\``).join(', ')}; Playwright in Chromium (D-079) |`,
    '',
    ...manualSection('1. Scope and method (manual)', 'scope', blocks),
    '## 2. Summary',
    '',
    summaryTable(criteria, blocks, ctx.evidence, ruleCount, protocolCount),
    '',
    ...manualSection(
      '3. Assistive-technology runs',
      'assistive-technology',
      blocks,
      resultsList(ctx.results),
    ),
    ...manualSection('4. Cognitive review (manual)', 'cognitive-review', blocks),
    ...manualSection(
      '5. Barriers axe cannot see (manual)',
      'barriers-axe-cannot-see',
      blocks,
      'The protocol’s [§8](manual-test-protocol.md#8-known-h5p-problems-to-expect) lists the known H5P problems ' +
        'testers should expect, among them barriers in the editor that axe cannot see (D-080).',
    ),
    ...principles,
    '## 10. Known H5P upstream barriers',
    '',
    registerTables(ctx.register, criteriaOfRule),
    '',
    ...manualSection('11. Notes for the uustatus.no statement (manual)', 'uustatus-notes', blocks),
    '## Appendix A. The last automated run',
    '',
    runAppendix(summary),
    '',
    '## Appendix B. Views axe scanned',
    '',
    scannedViews(summary),
  ];
  // WHY: nothing is rewritten across the joined text, which holds the manual blocks; only the generated end is trimmed.
  return `${lines.join('\n').trimEnd()}\n`;
}
