/**
 * reportInvariants — INS-006's rules checked on a finished insight report, from the report alone: no shown count is
 * about 1 to k − 1 learners, no shown share or median is about fewer than k, a suppressed cell carries no value, a
 * hidden group hides all its cells (a hidden number of starters hides every question cell, a 0 too), and no hidden
 * count of an additive group follows from its total, also when INS-002's share correct gives away how many chose a
 * right option. That last check assumes single-answer choice questions, as the property datasets have.
 *
 * Why: the `[INS-006]` property tests (D-114) run this on reports built from random datasets; it must not reuse the
 *      code it checks, so it reads only the report's cells and the relations between them.
 * Spec: INS-006
 * Tests: apps/server/test/insight/insightSuppression.property.test.ts, apps/server/test/insight/insightService.int.test.ts
 */
import type { InsightReport } from '../../../src/insight/insightReport.js';

type Cell = { suppressed: true } | { suppressed: false; value: number };

const valueOf = (cell: Cell | null): number | undefined =>
  cell === null || cell.suppressed ? undefined : cell.value;

/** Every object with a `suppressed` key anywhere in a value. */
export function cellsIn(value: unknown, found: Cell[] = []): Cell[] {
  if (Array.isArray(value)) value.forEach((entry) => cellsIn(entry, found));
  else if (typeof value === 'object' && value !== null) {
    if ('suppressed' in value) found.push(value as Cell);
    else Object.values(value).forEach((entry) => cellsIn(entry, found));
  }
  return found;
}

/** The count cells of a report, each with where it is. */
function countCells(report: InsightReport): [string, Cell | null][] {
  const p = report.participation;
  return [
    ['started', p.started],
    ['completed', p.completed],
    ['courseLearners', p.courseLearners],
    ...report.items.map((item): [string, Cell] => [`item ${item.item}`, item.learners]),
    ...report.misconceptions.flatMap((entry) => groupsOf(entry).flatMap(({ cells }) => cells)),
    ...report.misconceptions.map((entry): [string, Cell] => [`question ${entry.item}`, entry.learners]),
    ...(report.videoEngagement ?? []).map((entry): [string, Cell] => [`video ${entry.item}`, entry.answered]),
  ];
}

/** The additive groups of one misconception entry, with their total cell. */
function groupsOf(
  entry: InsightReport['misconceptions'][number],
): { total: Cell; cells: [string, Cell][] }[] {
  if (entry.kind === 'choice') {
    const cells = entry.options.map((option): [string, Cell] => [`option ${option.index}`, option.learners]);
    return [{ total: entry.learners, cells: [...cells, ['noAnswer', entry.noAnswer]] }];
  }
  return entry.gaps.map((gap) => ({
    total: entry.learners,
    cells: [
      [`gap ${gap.index} correct`, gap.correct],
      ...gap.wrongAnswers.map((wrong): [string, Cell] => [
        `gap ${gap.index} ${wrong.answer}`,
        wrong.learners,
      ]),
      [`gap ${gap.index} otherWrong`, gap.otherWrong],
      [`gap ${gap.index} empty`, gap.empty],
    ],
  }));
}

/** A share or median, the count it is about (shown and at least k), and a count it would reveal (shown). */
type Measured = [where: string, cell: Cell | null, about: Cell | null, reveals: Cell | null];

/** Shares and medians, with the counts that must be shown for them to be shown. */
function measuredCells(report: InsightReport): Measured[] {
  const p = report.participation;
  const base = p.completionBase === 'course' ? p.courseLearners : p.started;
  return [
    ['completionRate', p.completionRate, base, p.completed],
    ['medianAttempts', p.medianAttempts, p.completed, null],
    ['medianMinutesOnTask', p.medianMinutesOnTask, p.started, null],
    ...report.items.flatMap((item): Measured[] => [
      [`first ${item.item}`, item.firstCorrect, item.learners, null],
      [`latest ${item.item}`, item.latestCorrect, item.learners, null],
    ]),
    ...(report.videoEngagement ?? []).map((entry): Measured => [
      `share ${entry.item}`,
      entry.share,
      p.started,
      entry.answered,
    ]),
  ];
}

/** Why a hidden cell of a group with a shown total follows from it, or undefined. */
function derivation(total: number, cells: readonly [string, Cell][]): string | undefined {
  const hidden = cells.filter(([, cell]) => cell.suppressed);
  const hiddenSum = total - cells.reduce((sum, [, cell]) => sum + (valueOf(cell) ?? 0), 0);
  // PRIVACY: one hidden cell is the total minus the others; hidden cells adding up to 0 are each 0.
  if (hidden.length === 1 || (hidden.length > 1 && hiddenSum <= 0)) return hidden.map(([w]) => w).join(', ');
  return undefined;
}

/** A choice question's wrong options and «no answer», with their total from INS-002's share correct, if shown. */
function wrongPartOf(
  report: InsightReport,
  entry: InsightReport['misconceptions'][number],
): { total: number; cells: [string, Cell][] } | undefined {
  const item = report.items.find((candidate) => candidate.item === entry.item);
  const [share, learners] = [valueOf(item?.firstCorrect ?? null), valueOf(item?.learners ?? null)];
  if (entry.kind !== 'choice' || share === undefined || learners === undefined) return undefined;
  const cells = entry.options
    .filter(({ correct }) => !correct)
    .map((option): [string, Cell] => [`option ${option.index}`, option.learners]);
  return { total: learners - Math.round(share * learners), cells: [...cells, ['noAnswer', entry.noAnswer]] };
}

/** The count cells about the learners who started: every question cell. */
const questionCells = (report: InsightReport): Cell[] =>
  cellsIn([report.items, report.misconceptions, report.videoEngagement]);

/**
 * Lists every way a report breaks INS-006.
 * @param report - A report.
 * @returns Human-readable violations; empty when the report keeps the rules.
 */
export function insightInvariantViolations(report: InsightReport): string[] {
  const { k } = report.scope;
  const problems: string[] = [];
  for (const cell of cellsIn(report)) {
    if (cell.suppressed && Object.keys(cell).length !== 1)
      problems.push('a suppressed cell carries more than its flag');
  }
  for (const [where, cell] of countCells(report)) {
    const value = valueOf(cell);
    if (value !== undefined && value > 0 && value < k) problems.push(`${where} shows ${value} < k`);
  }
  for (const [where, cell, about, reveals] of measuredCells(report)) {
    if (valueOf(cell) === undefined) continue;
    if ((valueOf(about) ?? 0) < k)
      problems.push(`${where} is shown although it is about fewer than k learners`);
    if (reveals !== null && valueOf(reveals) === undefined) problems.push(`${where} reveals a hidden count`);
  }
  if (report.participation.started.suppressed && questionCells(report).some((cell) => !cell.suppressed))
    problems.push('a question shows a cell although the learners who started are hidden');
  for (const entry of report.misconceptions) {
    // WHY: when INS-002 shows the share correct, the right options' total is public (D-106 shows such shares), so
    // the reader knows more about the wrong options than the whole group says: check that part, against its total.
    const wrong = wrongPartOf(report, entry);
    const found = wrong && derivation(wrong.total, wrong.cells);
    if (found) problems.push(`question ${entry.item}: a hidden value follows from INS-002 (${found})`);
    for (const { total, cells } of groupsOf(entry)) {
      const all = valueOf(total);
      if (all === undefined) {
        if (cells.some(([, cell]) => !cell.suppressed))
          problems.push(`question ${entry.item}: a hidden total shows a cell`);
        continue;
      }
      const derived = wrong === undefined ? derivation(all, cells) : undefined;
      if (derived)
        problems.push(`question ${entry.item}: a hidden value follows from the total (${derived})`);
    }
  }
  return problems;
}
