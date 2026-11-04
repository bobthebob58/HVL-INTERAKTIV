/**
 * additiveGroupCells — suppresses a group of learner counts that add up to a known total (the options of a choice
 * question, the answers to one gap), with complementary suppression, so no hidden count can be worked out from the
 * total, the shown cells and this rule, which is public.
 *
 * Why: INS-006: "If suppression of one cell would let a hidden value be worked out from the totals, the
 *      next-smallest cell is suppressed too." With one hidden option and a shown number of learners, the hidden
 *      option is the total minus the others. A reader can also use the rule itself: a cell hidden below k holds 1 to
 *      k − 1, and a complement is where the rule puts it, so the complement must leave real doubt (D-106).
 * Spec: INS-006, INS-003
 * Invariants:
 *   - PRIVACY: when the total is about 1 to *k* − 1 learners, every cell of the group is suppressed, a 0 too.
 *   - Otherwise each count of 1 to *k* − 1 is suppressed (./insightCells.ts), and a complement is hidden too when
 *     exactly one count is, or when two or more are and all hold 1 or all hold *k* − 1 (sums a reader could split).
 *   - The complement is every shown 0 (a 0 is the next-smallest cell). Hiding only the first 0 is not enough: a
 *     reader who knows the rule can tell which hidden cell it is and subtract. A group with no 0 hides its smallest
 *     shown count and each next one less than *k* above the last one hidden; that cell holds *k* or more.
 *   - Checked exhaustively (`[INS-006]`, k 3–6, up to five cells): no hidden cell of 1 to *k* − 1 is determined by
 *     the total, the shown cells and this rule, except when every cell holds 1 and none is left to hide (as many
 *     learners as cells, each in a cell of their own), which only hiding the total could protect (a residual).
 *   - A caller makes its groups add up: an option nobody chose is 0, and an answer that names no option is a cell
 *     of its own («no answer»). A part whose total a reader knows from elsewhere (INS-002's share correct) is a group
 *     of its own (`partitionedGroupCells`).
 *   - The order of the cells is kept; nothing tells a primary hidden cell from a complementary one.
 * Collaborators: ./insightCells.ts, ../aggregate/choiceDistribution.ts, ../aggregate/gapMisconceptions.ts.
 * Tests: apps/server/test/insight/insightCells.test.ts, apps/server/test/insight/additiveGroupExhaustive.test.ts,
 *   apps/server/test/insight/insightSuppression.property.test.ts
 */
import type { InsightCountCell } from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import { countCell, isShowableCount, SUPPRESSED_CELL } from './insightCells.js';

/**
 * The complement to hide: every shown 0; when the group has none, the smallest shown count and each next one that is
 * less than *k* above the last one hidden.
 * @param size - The minimum group size.
 * @param counts - The group's counts.
 * @param hidden - Which cells are hidden.
 * @returns The indices to hide too; empty when every cell is hidden.
 */
function complementOf(
  size: MinimumGroupSize,
  counts: readonly number[],
  hidden: readonly boolean[],
): number[] {
  const count = (index: number): number => counts[index] ?? 0;
  const shown = counts.flatMap((_, index) => (hidden[index] ? [] : [index]));
  const zeros = shown.filter((index) => count(index) === 0);
  // WHY: a single hidden 0 can be located by a reader who knows the rule (the first 0); hiding every 0 cannot.
  if (zeros.length > 0) return zeros;
  const ascending = [...shown].sort((a, b) => count(a) - count(b) || a - b);
  const picked: number[] = [];
  for (const index of ascending) {
    const last = picked.at(-1);
    // WHY: a complement is at most the next shown count; when that is within k of it, the bound pins the hidden ones.
    if (last !== undefined && count(index) - count(last) >= size.k) break;
    picked.push(index);
  }
  return picked;
}

/**
 * Tells whether the cells hidden below k could be worked out from their sum.
 * @param size - The minimum group size.
 * @param values - The counts hidden below k.
 * @returns True for one such cell, or two or more that all hold 1 or all hold *k* − 1.
 */
function solvable(size: MinimumGroupSize, values: readonly number[]): boolean {
  if (values.length === 1) return true;
  // WHY: cells hidden below k each hold 1 to k − 1, so a sum of n × 1 or n × (k − 1) gives each of them away.
  return values.length >= 2 && (values.every((v) => v === 1) || values.every((v) => v === size.k - 1));
}

/**
 * The cells of one additive group, with primary and complementary suppression.
 * @param size - The minimum group size.
 * @param total - The distinct learners the group is about, e.g. the learners who answered the question.
 * @param counts - The learners in each cell, in display order.
 * @returns One cell per count, in the same order.
 * @example
 * // k = 5: 12 chose A, 8 chose B, 2 chose C, nobody gave no answer: C is hidden, and so is the 0, the next-smallest.
 * additiveGroupCells(minimumGroupSize(5), 22, [12, 8, 2, 0]);
 * // → [{ suppressed: false, value: 12 }, { suppressed: false, value: 8 }, { suppressed: true }, { suppressed: true }]
 * @spec INS-006
 */
export function additiveGroupCells(
  size: MinimumGroupSize,
  total: number,
  counts: readonly number[],
): InsightCountCell[] {
  // PRIVACY: a hidden total hides its whole group; even a 0 there would describe each of a few learners (INS-006).
  if (!isShowableCount(size, total)) return counts.map(() => SUPPRESSED_CELL);
  const hidden = counts.map((count) => !isShowableCount(size, count));
  const belowK = counts.filter((_, index) => hidden[index]);
  // PRIVACY: the hidden counts could be worked out from the total, so the next-smallest is hidden too (INS-006).
  if (solvable(size, belowK)) for (const index of complementOf(size, counts, hidden)) hidden[index] = true;
  return counts.map((count, index) => (hidden[index] ? SUPPRESSED_CELL : countCell(size, count)));
}

/**
 * The cells of an additive group made of parts whose own totals a reader knows from elsewhere, e.g. a single-answer
 * question's right options (INS-002 shows the share correct) and its wrong options with «no answer».
 * @param size - The minimum group size.
 * @param total - The distinct learners the whole group is about.
 * @param counts - The learners in each cell, in display order.
 * @param parts - A partition of the cell indices; each part is suppressed as a group of its own.
 * @returns One cell per count, in the same order.
 * @spec INS-006
 */
export function partitionedGroupCells(
  size: MinimumGroupSize,
  total: number,
  counts: readonly number[],
  parts: readonly (readonly number[])[],
): InsightCountCell[] {
  // PRIVACY: a hidden total hides every part, as in a single group (INS-006).
  if (!isShowableCount(size, total)) return counts.map(() => SUPPRESSED_CELL);
  const cells: InsightCountCell[] = counts.map(() => SUPPRESSED_CELL);
  for (const part of parts) {
    const partCounts = part.map((index) => counts[index] ?? 0);
    const partTotal = partCounts.reduce((sum, count) => sum + count, 0);
    // PRIVACY: a part's total is known from INS-002, so it is protected as a group of its own (INS-006).
    additiveGroupCells(size, partTotal, partCounts).forEach((cell, at) => {
      const index = part[at];
      if (index !== undefined) cells[index] = cell;
    });
  }
  return cells;
}
