/**
 * dpoBriefProblems — the differences between the brief for the DPO's first meeting
 * (docs/privacy/dpo-first-meeting.md) and the residual table of the DPIA input that it sorts by theme.
 *
 * Why: the brief is a short way into DPIA-INPUT.md for HVL's data protection officer (the owner's request,
 *      2026-11-28). A summary that a later step forgets is worse than none: the DPO would rely on a list that
 *      misses the newest residual. D-113 counts a test that compares a document with its source as the
 *      requirement's test, so the brief's table is held to DPIA-INPUT.md §12.
 * Spec: DATA-005
 * Invariants:
 *   - The theme table in the brief's §3 names every residual R1…Rn of DPIA-INPUT.md §12 exactly once, as `R7` or
 *     as a range `R1–R4`, and each theme's count is the number of residuals its row names.
 *   - The table's last row reads `**All**`, `**n**` and `R1–Rn`. That row is the only place the brief states the
 *     total.
 *   - Every residual the brief cites anywhere is in §12.
 *   - Problems name the theme or the residual, never a person's data (the documents hold none).
 * Collaborators: ./checkDpiaInput.mjs (reads the files, counts §12's rows and reports),
 *   docs/privacy/dpo-first-meeting.md, docs/privacy/DPIA-INPUT.md §12.
 * Tests: tools/privacy/test/dpoBriefProblems.test.mjs
 */

/** The widest range of residuals a cell may name; a typing error must not make the check loop for long. */
const WIDEST_RANGE = 999;

/**
 * The residual numbers a text names, ranges written out.
 * @param {string} text - A table cell or a whole document.
 * @returns {number[]} The numbers, in the order named; one entry per naming.
 */
export function residualsNamed(text) {
  const named = [];
  const singles = text.replace(/\bR(\d+)[–-]R(\d+)\b/g, (_range, from, to) => {
    const last = Math.min(Number(to), Number(from) + WIDEST_RANGE);
    for (let n = Number(from); n <= last; n += 1) named.push(n);
    return '';
  });
  for (const [, n] of singles.matchAll(/\bR(\d+)\b/g)) named.push(Number(n));
  return named;
}

/** The rows of the brief's theme table (§3) whose second cell is a count, as trimmed cells. */
function themeRows(brief) {
  const start = brief.search(/^## 3\. /m);
  const rest = start < 0 ? '' : brief.slice(start + 3);
  const end = rest.search(/^## /m);
  return (end < 0 ? rest : rest.slice(0, end))
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => /^\**\d+\**$/.test(cells[1] ?? ''));
}

/**
 * Compares the brief with the number of residuals DPIA-INPUT.md §12 lists.
 * @param {number} residualCount - How many residuals §12 has (R1…Rn, which the DPIA input's own check holds).
 * @param {string} brief - The brief for the DPO's first meeting.
 * @returns {string[]} The problems; none when the brief names each residual once.
 */
export function dpoBriefProblems(residualCount, brief) {
  const problems = [];
  const rows = themeRows(brief);
  const themes = rows.filter((cells) => cells[0] !== '**All**');
  const times = new Map();
  for (const [theme, count, residuals] of themes) {
    const named = residualsNamed(residuals ?? '');
    if (Number(count) !== named.length) {
      problems.push(`DPO brief §3: «${theme}» says ${count} but names ${named.length}`);
    }
    for (const n of named) times.set(n, (times.get(n) ?? 0) + 1);
  }
  for (let n = 1; n <= residualCount; n += 1) {
    const found = times.get(n) ?? 0;
    if (found === 0) problems.push(`DPO brief §3: R${n} is in no theme`);
    if (found > 1) problems.push(`DPO brief §3: R${n} is in ${found} themes`);
  }
  for (const n of new Set(residualsNamed(brief))) {
    if (n < 1 || n > residualCount)
      problems.push(`DPO brief cites R${n}, which DPIA-INPUT.md §12 does not list`);
  }
  const all = rows.find((cells) => cells[0] === '**All**');
  if (all?.[1] !== `**${residualCount}**` || all?.[2] !== `R1–R${residualCount}`) {
    problems.push(
      `DPO brief §3: the last row must read **All**, **${residualCount}** and R1–R${residualCount}`,
    );
  }
  return problems;
}
