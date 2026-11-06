/**
 * protocolIndex — reads the manual test protocol's steps (§6) and page checks (§7), and the dated result files in
 * docs/accessibility/results/, for the conformance report.
 *
 * Why: UD-040 names the manual evidence of each criterion next to the automated one, and UD-031 keeps the results
 *      as dated files. Reading both from the documents themselves means a step renamed in the protocol, or a run
 *      recorded by HVL, reaches the report at the next regeneration, and a step the evidence map names that the
 *      protocol no longer has stops the generator.
 * Spec: UD-040, UD-031
 * Invariants:
 *   - A step is a table row whose first cell is `J<n>.<n>`; its action is the second cell, as written.
 *   - A §7 check is a row of the table under "## 7."; the criteria are the WCAG numbers in its last cell.
 *   - A result file is any `.md` in the results folder but README.md; one named `YYYY-MM-DD-<release>-<set-up>.md`
 *     gives its date, release and set-up, any other name is listed as it is. Nothing is read from inside them.
 * Collaborators: docs/accessibility/manual-test-protocol.md, docs/accessibility/results/README.md,
 *   ./renderCriterion.mjs, ./renderReport.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The protocol, relative to the repository root. */
export const PROTOCOL_PATH = 'docs/accessibility/manual-test-protocol.md';
/** The folder of dated manual results. */
export const RESULTS_DIR = 'docs/accessibility/results';

const cells = (row) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

/**
 * Reads the protocol.
 * @param {string} text - The protocol's Markdown.
 * @returns {{steps: Map<string, string>, checks: {name: string, criteria: string[]}[]}} Steps by ID with their
 *   action, and the §7 checks with the criteria they name.
 */
export function readProtocol(text) {
  const steps = new Map();
  for (const line of text.split('\n')) {
    const row = /^\|\s*(J\d+\.\d+)\s*\|/.exec(line);
    if (row) steps.set(row[1], cells(line)[1]);
  }
  const section = /^## 7\..*$([\s\S]*?)(?=^## )/m.exec(text)?.[1] ?? '';
  const checks = section
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*(Check|-)/.test(l))
    .map((l) => cells(l))
    .map((c) => ({
      name: c[0],
      criteria: [...c[c.length - 1].matchAll(/\b\d\.\d\.\d+\b/g)].map((m) => m[0]),
    }));
  return { steps, checks };
}

/**
 * Finds what a protocol reference names: a step (`J2.3`) or a §7 check (`§7 Reduced motion`).
 * @param {{steps: Map<string, string>, checks: {name: string}[]}} protocol - From readProtocol.
 * @param {string} ref - The reference as the evidence map writes it.
 * @returns {string} The step's action or the check's name.
 * @throws Error when the protocol has no such step or check.
 */
export function protocolText(protocol, ref) {
  if (ref.startsWith('§7 ')) {
    const check = protocol.checks.find((c) => c.name === ref.slice(3));
    if (check) return check.name;
  } else if (protocol.steps.has(ref)) return protocol.steps.get(ref);
  throw new Error(`the evidence map names "${ref}", which ${PROTOCOL_PATH} does not have`);
}

/**
 * Reads the protocol from the repository.
 * @param {string} root - Repository root.
 * @returns {{steps: Map<string, string>, checks: {name: string, criteria: string[]}[]}} As readProtocol.
 */
export const loadProtocol = (root) => readProtocol(readFileSync(join(root, PROTOCOL_PATH), 'utf8'));

/**
 * Lists the dated manual result files.
 * @param {string} root - Repository root.
 * @returns {{file: string, date?: string, release?: string, setUp?: string}[]} By file name.
 */
export function resultFiles(root) {
  const dir = join(root, RESULTS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((file) => {
      const m = /^(\d{4}-\d{2}-\d{2})-([^-]+)-(.+)\.md$/.exec(file);
      return m ? { file, date: m[1], release: m[2], setUp: m[3] } : { file };
    });
}
