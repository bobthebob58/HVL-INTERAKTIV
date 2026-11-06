/**
 * manualBlocks — reads the parts of the conformance report that people write (between `<!-- manual:start <id> -->`
 * and `<!-- manual:end <id> -->`), so a regeneration copies them back unchanged, and seeds the ones still missing.
 *
 * Why: UD-040's verdicts, the assistive-technology runs and the cognitive review are HVL's evaluation; a generator
 *      that rewrote them would destroy that work. So it stops on anything it cannot read for certain instead of
 *      dropping or guessing text (D-079 amendment of 2026-11-05).
 * Spec: UD-040, UD-031
 * Invariants:
 *   - A block's text is copied byte for byte, including its first and last line breaks.
 *   - Parsing fails on a marker that is not exactly `<!-- manual:start|end <id> -->` (one in other letter case
 *     included), a start inside a block, an end without its start or with another ID, a block left open, and an ID
 *     used twice.
 *   - A criterion block (`sc-<number>`) has exactly one line `**Verdict:** <verdict>` with one of VERDICTS. A verdict
 *     other than *Not yet determined* needs the line `**Evaluated by HVL:**` beginning with its date (YYYY-MM-DD),
 *     so no verdict stands without a dated HVL evaluation (D-079 amendment of the S6 step 6 review). Nothing else
 *     is read from any block.
 *   - A seeded block says *Not yet determined* and *Not yet tested by HVL*; it carries no date, because nobody has
 *     tested anything yet.
 * Collaborators: ./renderReport.mjs, ./renderCriterion.mjs.
 * Tests: tools/a11y-report/test/manualBlocks.test.mjs, tools/a11y-report/test/a11yReport.test.mjs
 */

/** The verdicts a criterion can have, in the words of the VPAT/EN 301 549 conformance levels. */
export const VERDICTS = [
  'Supports',
  'Partially supports',
  'Does not support',
  'Not applicable',
  'Not yet determined',
];

/** The verdict that needs no evaluation behind it. */
export const UNDECIDED = 'Not yet determined';

// WHY: case-insensitive, so `<!-- Manual:start x -->` stops the parser instead of being rewritten as generated text.
const ANY_MARKER = /<!--\s*manual\b[^>]*?-->|<!--\s*manual\b/gi;
const MARKER = /^<!-- manual:(start|end) ([a-z0-9][a-z0-9.-]*) -->$/;
const EVALUATED = /^\*\*Evaluated by HVL:\*\*[ \t]*\d{4}-\d{2}-\d{2}\b/m;

/**
 * The block ID of a success criterion.
 * @param {string} criterionId - E.g. `1.4.10`.
 * @returns {string} E.g. `sc-1.4.10`.
 */
export const criterionBlockId = (criterionId) => `sc-${criterionId}`;

/**
 * Reads every manual block of a report.
 * @param {string} text - The report as committed.
 * @returns {Map<string, string>} Each block's text by its ID, in the order they appear.
 * @throws Error on a broken, nested, unclosed or duplicate marker.
 */
export function parseManualBlocks(text) {
  const blocks = new Map();
  let open;
  for (const m of text.matchAll(ANY_MARKER)) {
    const line = text.slice(0, m.index).split('\n').length;
    const marker = MARKER.exec(m[0]);
    if (!marker) throw new Error(`line ${line}: "${m[0]}" is not a manual marker the generator can read`);
    const [, kind, id] = marker;
    if (kind === 'start') {
      if (open) throw new Error(`line ${line}: manual block "${id}" starts inside "${open.id}"`);
      if (blocks.has(id)) throw new Error(`line ${line}: manual block "${id}" appears twice`);
      open = { id, from: m.index + m[0].length };
    } else {
      if (!open || open.id !== id) throw new Error(`line ${line}: manual:end "${id}" has no matching start`);
      blocks.set(id, text.slice(open.from, m.index));
      open = undefined;
    }
  }
  if (open) throw new Error(`manual block "${open.id}" is never closed`);
  return blocks;
}

/**
 * Reads the verdict of a criterion block.
 * @param {string} id - The block ID, for the message.
 * @param {string} body - The block's text.
 * @returns {string} One of VERDICTS.
 * @throws Error when the verdict line is missing, appears twice or names no known verdict.
 */
export function verdictOf(id, body) {
  const lines = [...body.matchAll(/^\*\*Verdict:\*\*[ \t]*(.*)$/gm)];
  if (lines.length === 0) throw new Error(`manual block "${id}" has no line "**Verdict:** …"`);
  if (lines.length > 1) throw new Error(`manual block "${id}" has ${lines.length} lines "**Verdict:** …"`);
  const verdict = lines[0][1].trim();
  if (!VERDICTS.includes(verdict))
    throw new Error(
      `manual block "${id}": "${verdict}" is not one of ${VERDICTS.map((v) => `«${v}»`).join(', ')}`,
    );
  return verdict;
}

/**
 * Checks a criterion block: one known verdict, and a dated HVL evaluation behind any verdict but UNDECIDED.
 * @param {string} id - The block ID, for the message.
 * @param {string} body - The block's text.
 * @returns {string} Its verdict.
 * @throws Error as verdictOf does, or when a decided verdict has no `**Evaluated by HVL:** YYYY-MM-DD …` line.
 */
export function checkCriterionBlock(id, body) {
  const verdict = verdictOf(id, body);
  if (verdict !== UNDECIDED && !EVALUATED.test(body))
    throw new Error(
      `manual block "${id}" says «${verdict}» but has no line "**Evaluated by HVL:** YYYY-MM-DD …": ` +
        `write the date of HVL's evaluation, or keep «${UNDECIDED}»`,
    );
  return verdict;
}

/**
 * The text of a criterion block nobody has filled in yet.
 * @returns {string} The seeded body.
 */
export const seededCriterionBody = () =>
  '\n**Verdict:** Not yet determined\n\n**Evaluated by HVL:** Not yet tested by HVL.\n\n' +
  '**Manual evidence and remarks:** None yet.\n';

/**
 * The text of a general manual section nobody has filled in yet.
 * @returns {string} The seeded body.
 */
export const seededSectionBody = () => '\n*Not yet tested by HVL.* No date: nothing is recorded here yet.\n';

/**
 * Writes a block with its markers.
 * @param {string} id - The block ID.
 * @param {string} body - Its text, copied or seeded.
 * @returns {string} The block as it stands in the report.
 */
export const manualBlock = (id, body) => `<!-- manual:start ${id} -->${body}<!-- manual:end ${id} -->`;

/**
 * Takes the blocks a report needs from the committed ones, seeding those it lacks.
 * @param {Map<string, string>} existing - From parseManualBlocks.
 * @param {string[]} criterionIds - Block IDs of the criteria, in report order.
 * @param {string[]} sectionIds - Block IDs of the general sections.
 * @returns {Map<string, string>} A body for every needed ID.
 * @throws Error when the report holds a block the generator does not know (its text would be lost) or a criterion
 *   block that checkCriterionBlock refuses.
 */
export function resolveBlocks(existing, criterionIds, sectionIds) {
  const needed = new Set([...criterionIds, ...sectionIds]);
  for (const id of existing.keys())
    if (!needed.has(id))
      throw new Error(`manual block "${id}" belongs to no section; move its text, then remove it`);
  const resolved = new Map();
  for (const id of criterionIds) {
    const body = existing.get(id) ?? seededCriterionBody();
    checkCriterionBlock(id, body);
    resolved.set(id, body);
  }
  for (const id of sectionIds) resolved.set(id, existing.get(id) ?? seededSectionBody());
  return resolved;
}
