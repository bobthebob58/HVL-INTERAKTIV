/**
 * checkDpiaInput — fails when the DPIA input (docs/privacy/DPIA-INPUT.md) misses one of its sections, when its
 * account of the Canvas developer key differs from the key itself, or when its residual table or a residual cited
 * elsewhere is out of order.
 *
 * Why: DATA-005 asks for the DPIA input that HVL's data protection officer reviews; D-113 counts a test that compares
 *      a document with its sources as that requirement's test. The key's privacy level, scopes and custom fields decide
 *      what Canvas releases to the server whatever the code does, so DPIA-INPUT.md §6 must never drift from
 *      docs/reference/canvas-lti13-developer-key.json; and decisions, the inventory and PROGRESS cite residuals by
 *      number, so the numbers must stay whole.
 * Spec: DATA-005
 * Invariants:
 *   - Sections `## 1.` to `## 13.` exist, in order.
 *   - §6 states the key's `privacy_level`, names every scope (by its last path segment), says «none» for tool-level
 *     custom fields when the key has none, and has one `Placement` row per placement that lists each of its custom
 *     fields as `name = value`; it lists no placement the key lacks.
 *   - §12's table numbers its residuals R1…Rn without a gap, each row with six filled cells.
 *   - Every `R<n>` cited in DPIA-INPUT.md or DATA-INVENTORY.md is in that table.
 *   - Every range `R1–R<n>` in §13, the questions for the DPO, ends at the table's last residual.
 *   - Problems name the section, the field or the number, never a person's data (the documents hold none).
 * Collaborators: docs/privacy/DPIA-INPUT.md, docs/reference/canvas-lti13-developer-key.json,
 *   docs/privacy/DATA-INVENTORY.md, CI and the gate (`npm run privacy:dpia-check`), docs/EVALUATOR-GUIDE.md §5.
 * Tests: tools/privacy/test/checkDpiaInput.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The documents, relative to the repository root. */
export const DPIA_FILES = {
  dpia: 'docs/privacy/DPIA-INPUT.md',
  key: 'docs/reference/canvas-lti13-developer-key.json',
  inventory: 'docs/privacy/DATA-INVENTORY.md',
};

/** How many numbered sections the DPIA input has. */
export const DPIA_SECTIONS = 13;

/**
 * The text of one numbered section, up to the next `## ` heading.
 * @param {string} dpia - The DPIA input.
 * @param {number} n - The section number.
 * @returns {string | undefined} The section, or undefined when it is missing.
 */
export function sectionOf(dpia, n) {
  const start = dpia.search(new RegExp(`^## ${n}\\. `, 'm'));
  if (start < 0) return undefined;
  const rest = dpia.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

/** The cells of a Markdown table row, trimmed. */
const cellsOf = (row) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

/** Rows of a section's tables whose first cell matches. */
const rowsWhere = (section, first) =>
  section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map(cellsOf)
    .filter((cells) => first.test(cells[0] ?? ''));

/**
 * Compares §6 with the developer key.
 * @param {string} section - §6 of the DPIA input.
 * @param {any} key - The developer key's JSON.
 * @returns {string[]} The differences.
 */
export function keyProblems(section, key) {
  const canvas = (key.extensions ?? []).find((e) => e.platform === 'canvas.instructure.com') ?? {};
  const problems = [];
  const [level] = rowsWhere(section, /^`privacy_level`$/);
  if (!level || !level[1]?.includes(`\`${canvas.privacy_level}\``)) {
    problems.push(`§6: privacy_level must read \`${canvas.privacy_level}\`, as the developer key has it`);
  }
  const [scopes] = rowsWhere(section, /^Scopes$/);
  for (const scope of key.scopes ?? []) {
    const last = scope.split('/').slice(-2).join('/');
    if (!scopes?.[1]?.includes(last)) problems.push(`§6: the scope ${last} is not named`);
  }
  const [tool] = rowsWhere(section, /^Tool-level `custom_fields`$/);
  const toolFields = Object.entries(canvas.custom_fields ?? {});
  const toolText = tool?.[1] ?? '';
  if (toolFields.length === 0 ? !/none/i.test(toolText) : toolFields.some(([n]) => !toolText.includes(n))) {
    problems.push('§6: the tool-level custom fields differ from the developer key');
  }
  const placements = canvas.settings?.placements ?? [];
  const rows = rowsWhere(section, /^Placement `/);
  for (const placement of placements) {
    const row = rows.find((cells) => cells[0].startsWith(`Placement \`${placement.placement}\``));
    if (!row) {
      problems.push(`§6: the placement ${placement.placement} has no row`);
      continue;
    }
    for (const [name, value] of Object.entries(placement.custom_fields ?? {})) {
      if (!row[1].includes(`${name} = ${value}`)) {
        problems.push(`§6: the placement ${placement.placement} does not list ${name} = ${value}`);
      }
    }
  }
  for (const cells of rows) {
    const name = /^Placement `([^`]+)`/.exec(cells[0])?.[1];
    if (!placements.some((p) => p.placement === name))
      problems.push(`§6: the placement ${name} is not in the key`);
  }
  return problems;
}

/**
 * Checks the residual table, every residual cited and the range §13 asks the DPO about.
 * @param {string} dpia - The DPIA input.
 * @param {string} inventory - The data inventory.
 * @returns {string[]} The problems.
 */
export function residualProblems(dpia, inventory) {
  const rows = rowsWhere(sectionOf(dpia, 12) ?? '', /^R\d+$/);
  const problems = [];
  rows.forEach((cells, index) => {
    if (cells[0] !== `R${index + 1}`) problems.push(`§12: ${cells[0]} stands where R${index + 1} should`);
    if (cells.length !== 6 || cells.some((cell) => cell === '')) {
      problems.push(`§12: ${cells[0]} needs six filled cells`);
    }
  });
  const known = new Set(rows.map((cells) => cells[0]));
  for (const [name, text] of [
    ['DPIA-INPUT.md', dpia],
    ['DATA-INVENTORY.md', inventory],
  ]) {
    const cited = new Set(text.match(/\bR\d+\b/g) ?? []);
    for (const id of cited) if (!known.has(id)) problems.push(`${name} cites ${id}, which §12 does not list`);
  }
  const last = `R${rows.length}`;
  for (const [, end] of (sectionOf(dpia, 13) ?? '').matchAll(/\bR1[–-](R\d+)\b/g)) {
    if (end !== last) problems.push(`§13: the DPO is asked about R1–${end}, but §12 runs to ${last}`);
  }
  if (rows.length === 0) problems.push('§12: the residual table is missing');
  return problems;
}

/**
 * Every problem of the DPIA input.
 * @param {{dpia: string, key: any, inventory: string}} docs - The three documents.
 * @returns {string[]} The problems; none when the input is consistent.
 */
export function dpiaProblems({ dpia, key, inventory }) {
  const problems = [];
  let last = -1;
  for (let n = 1; n <= DPIA_SECTIONS; n += 1) {
    const at = dpia.search(new RegExp(`^## ${n}\\. `, 'm'));
    if (at < 0) problems.push(`section ${n} is missing`);
    else if (at < last) problems.push(`section ${n} is out of order`);
    else last = at;
  }
  const keySection = sectionOf(dpia, 6);
  if (keySection) problems.push(...keyProblems(keySection, key));
  return [...problems, ...residualProblems(dpia, inventory)];
}

/**
 * Reads the three documents from a checkout.
 * @param {string} root - The repository root.
 * @returns {{dpia: string, key: any, inventory: string}} The documents.
 */
export function readDpiaDocs(root) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  return {
    dpia: read(DPIA_FILES.dpia),
    key: JSON.parse(read(DPIA_FILES.key)),
    inventory: read(DPIA_FILES.inventory),
  };
}

// WHY: tests import the functions without running the check.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const problems = dpiaProblems(readDpiaDocs(root));
  for (const problem of problems) process.stderr.write(`DPIA input: ${problem}\n`);
  if (problems.length > 0) process.exitCode = 1;
  else
    process.stdout.write(
      `DPIA input: ${DPIA_SECTIONS} sections, the developer key and the residuals agree\n`,
    );
}
