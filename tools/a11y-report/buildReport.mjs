/**
 * buildReport — gathers the conformance report's sources from the repository and composes the report from them and
 * from the manual blocks of the committed report.
 *
 * Why: UD-040's generator must keep what people wrote and give the same file for the same sources. Loading the
 *      sources once (`loadSources`) and composing purely from them (`composeReport`) lets the CLI write and check
 *      the report, and lets the tests regenerate it repeatedly with changed manual blocks or runs.
 * Spec: UD-040
 * Invariants:
 *   - `composeReport` reads no file and no clock: the same sources, summary and committed text give the same text.
 *   - It stops before writing anything on a broken evidence map, a broken manual block, a step the protocol does not
 *     have or a check that matches no test.
 *   - The composed report is read back: it must give exactly the blocks that went in, byte for byte, so generated
 *     text can never open, close or swallow a block at the next regeneration.
 * Collaborators: ./criterionEvidence.mjs, ./axeRuleIndex.mjs, ./testIndex.mjs, ./protocolIndex.mjs,
 *   ./upstreamEntries.mjs, ./runSummary.mjs, ./manualBlocks.mjs, ./renderReport.mjs, ./a11yReport.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axeRuleIndex } from './axeRuleIndex.mjs';
import { EVIDENCE, evidenceProblems } from './criterionEvidence.mjs';
import { criterionBlockId, parseManualBlocks, resolveBlocks } from './manualBlocks.mjs';
import { loadProtocol, resultFiles } from './protocolIndex.mjs';
import { REPORT_PATH, SECTION_BLOCKS, renderReport } from './renderReport.mjs';
import { readSummary } from './runSummary.mjs';
import { indexTests } from './testIndex.mjs';
import { readRegister } from './upstreamEntries.mjs';
import { CRITERIA } from './wcagCriteria.mjs';

/**
 * Reads every source of the report except the run summary and the committed report.
 * @param {string} root - Repository root.
 * @returns {Promise<{criteria: object[], evidence: object, axeIndex: object, index: object[], protocol: object,
 *   register: object, results: object[]}>} The sources.
 */
export async function loadSources(root) {
  return {
    criteria: CRITERIA,
    evidence: EVIDENCE,
    axeIndex: axeRuleIndex(root),
    index: indexTests(root),
    protocol: loadProtocol(root),
    register: await readRegister(root),
    results: resultFiles(root),
  };
}

/**
 * Composes the report.
 * @param {Awaited<ReturnType<typeof loadSources>>} sources - From loadSources.
 * @param {object | undefined} summary - The run summary, or undefined before the first run.
 * @param {string} committed - The committed report ('' when there is none), for its manual blocks.
 * @returns {string} The report's Markdown.
 * @throws Error when the evidence map or a manual block is broken, or the report would not read back the same.
 */
export function composeReport(sources, summary, committed) {
  const problems = evidenceProblems(sources.evidence, sources.criteria);
  if (problems.length) throw new Error(`the evidence map is incomplete:\n  ${problems.join('\n  ')}`);
  const blocks = resolveBlocks(
    parseManualBlocks(committed),
    sources.criteria.map((c) => criterionBlockId(c.id)),
    SECTION_BLOCKS,
  );
  const report = renderReport({ ...sources, summary, blocks });
  const back = parseManualBlocks(report);
  const lost = [...blocks].filter(([id, body]) => back.get(id) !== body).map(([id]) => id);
  if (lost.length || back.size !== blocks.size)
    throw new Error(
      `the composed report does not read back its manual blocks (${lost.join(', ') || 'extra'})`,
    );
  return report;
}

/**
 * The committed report's text.
 * @param {string} root - Repository root.
 * @returns {string} Its text, or '' before it exists.
 */
export function committedReport(root) {
  const file = join(root, REPORT_PATH);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/**
 * Generates the report from the repository as it is.
 * @param {string} root - Repository root.
 * @returns {Promise<string>} The report's Markdown.
 */
export async function generateReport(root) {
  return composeReport(await loadSources(root), readSummary(root), committedReport(root));
}
