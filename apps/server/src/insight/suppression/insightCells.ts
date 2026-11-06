/**
 * insightCells — turns one aggregate about a known number of distinct learners into the cell an insight answer may
 * carry: its value when it is about at least *k* learners, otherwise a suppressed cell that carries no value.
 *
 * Why: INS-006 hides any cell, bar or list item about fewer than *k* distinct learners, and D-106 applies it as
 *      written: the API answer carries no value for it, only `{ suppressed: true }`. Every insight shape builds its
 *      cells here, so the rule is written once and the property tests (D-114) can check it in one place.
 * Spec: INS-006
 * Invariants:
 *   - PRIVACY: a count of 1 to *k* − 1 learners is suppressed; a rate or median is suppressed when the learners it
 *     is about number fewer than *k* (there is no value at all about 0 learners). A suppressed cell has exactly the
 *     key `suppressed` (the contract's `insightSuppressedCellSchema`), never a value, a rounded value or a hint.
 *   - SPEC-DEVIATION: D-106 — a count of 0 is shown: it is about no learner, so it singles no one out, and it is
 *     the "nobody chose this" signal D-106 keeps for rates of 0 %. A 0 is hidden only by its caller: as a complement
 *     (./additiveGroupCells.ts), or in a group whose total is suppressed, e.g. every question cell when the learners
 *     who started are (`suppressEveryCell`, ../buildInsightReport.ts).
 *   - D-095's two-sided rate rule (the mappe's) is not applied: a rate of 0 % or 100 % over at least *k* learners is
 *     shown (D-106).
 *   - *k* comes from ../../privacy/minimumGroupSize.ts, so it is an integer of at least 3.
 * Collaborators: ../../privacy/minimumGroupSize.ts, @hvl-interaktiv/api-contract (`insight.ts`),
 *   ./additiveGroupCells.ts, ../aggregate/*.
 * Tests: apps/server/test/insight/insightCells.test.ts, apps/server/test/insight/insightSuppression.property.test.ts
 */
import type {
  InsightCountCell,
  InsightMedianCell,
  InsightRateCell,
  InsightSuppressedCell,
} from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';

/** A cell that may be shown or suppressed; the shapes of the contract's count, rate and median cells. */
export type InsightCell = InsightCountCell | InsightRateCell | InsightMedianCell;

/** The one suppressed cell: no value, nothing that tells why it is hidden (INS-006). */
export const SUPPRESSED_CELL: InsightSuppressedCell = Object.freeze({ suppressed: true });

/**
 * A shown cell.
 * @param value - The value to show.
 * @returns `{ suppressed: false, value }`.
 */
const shown = (value: number) => ({ suppressed: false as const, value });

/**
 * Tells whether a count of distinct learners may be shown.
 * @param size - The minimum group size.
 * @param learners - How many distinct learners the count is.
 * @returns True for 0 and for *k* or more; false for 1 to *k* − 1.
 * @spec INS-006
 */
export const isShowableCount = (size: MinimumGroupSize, learners: number): boolean =>
  // SPEC-DEVIATION: D-106 — a 0 is about no learner and is shown, although INS-006's "fewer than k" takes it in.
  learners === 0 || learners >= size.k;

/**
 * The cell of a count of distinct learners.
 * @param size - The minimum group size.
 * @param learners - The count.
 * @returns The count, or the suppressed cell when it is 1 to *k* − 1.
 * @spec INS-006
 */
export function countCell(size: MinimumGroupSize, learners: number): InsightCountCell {
  // PRIVACY: a count of fewer than k learners (but not none) would point at a small group (INS-006).
  return isShowableCount(size, learners) ? shown(learners) : SUPPRESSED_CELL;
}

/**
 * The cell of a share from 0 to 1, e.g. a completion rate or the share correct.
 * @param size - The minimum group size.
 * @param share - The share; clamped to 0–1.
 * @param about - The distinct learners the share is about (its denominator).
 * @returns The share, or the suppressed cell when it is about fewer than *k* learners.
 * @spec INS-006
 */
export function rateCell(size: MinimumGroupSize, share: number, about: number): InsightRateCell {
  // PRIVACY: a share of a small group says what each of its few learners did (INS-006); D-106 keeps 0 % and 100 %.
  if (about < size.k || !Number.isFinite(share)) return SUPPRESSED_CELL;
  return shown(Math.min(1, Math.max(0, share)));
}

/**
 * The cell of a median, e.g. minutes on task or attempts.
 * @param size - The minimum group size.
 * @param median - The median.
 * @param about - The distinct learners the median is taken over.
 * @returns The median, or the suppressed cell when it is about fewer than *k* learners.
 * @spec INS-006
 */
export function medianCell(size: MinimumGroupSize, median: number, about: number): InsightMedianCell {
  // PRIVACY: the median of fewer than k learners is one of their own values (INS-006).
  return about < size.k || !Number.isFinite(median) || median < 0 ? SUPPRESSED_CELL : shown(median);
}

/**
 * The value of a cell, for building on it.
 * @param cell - A shown or suppressed cell.
 * @returns The value, or undefined for a suppressed cell.
 */
export const shownValue = (cell: InsightCell): number | undefined =>
  cell.suppressed ? undefined : cell.value;

/**
 * Suppresses a cell when the group it belongs to is suppressed.
 * @param cell - The cell.
 * @param groupShown - Whether the group's total (e.g. the learners who started) is shown.
 * @returns The cell, or the suppressed cell.
 * @spec INS-006
 */
export function withinShownGroup<T extends InsightCell>(
  cell: T,
  groupShown: boolean,
): T | InsightSuppressedCell {
  // PRIVACY: even a 0 says what every learner of a hidden small group did, so nothing of that group is shown.
  return groupShown ? cell : SUPPRESSED_CELL;
}

/**
 * Suppresses every cell in a part of a report, e.g. the questions of a view whose learners who started are hidden.
 * @param value - Report data: cells, lists and objects; texts and nulls ("not available") are kept.
 * @returns A copy in which every cell is the suppressed cell.
 * @spec INS-006
 */
export function suppressEveryCell<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry: unknown) => suppressEveryCell(entry)) as T;
  if (typeof value !== 'object' || value === null) return value;
  // PRIVACY: a cell of a hidden group says what each of its few learners did, even as a 0 (INS-006).
  if ('suppressed' in value) return SUPPRESSED_CELL as T;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]: [string, unknown]) => [key, suppressEveryCell(entry)]),
  ) as T;
}
