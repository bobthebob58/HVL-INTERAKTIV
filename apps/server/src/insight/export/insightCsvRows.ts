/**
 * insightCsvRows — flattens an insight report into the rows of its CSV export: one row per shown or suppressed value,
 * with a suppressed cell written as «< k» and a value that is not available left empty.
 *
 * Why: INS-009 exports insight as CSV "with the same suppression (INS-006) applied". Building the rows from the
 *      already suppressed report, never from the statements, means the CSV cannot hold anything the tab does not,
 *      and the INS-006 property tests check these rows too (D-106).
 * Spec: INS-009, INS-006
 * Invariants:
 *   - PRIVACY: a suppressed cell becomes `< k` (e.g. `< 5`) and nothing else; there is no column that could carry its
 *     value. A wrong gap answer appears only as the report lists it (given by at least k learners).
 *   - `measure` is a stable key and `section` a fixed name, so the API workstream writes the header and these words in
 *     `nn`, `nb` or `en` through i18n; `label` holds the activity's own text (question, option, interaction, answer).
 *   - Numbers are written with a dot: counts as integers, shares from 0 to 1 with four decimals, medians as computed.
 *   - Serialising (quoting, and neutralising a label that starts with `=`, `+`, `-` or `@` against formula injection)
 *     is the API's; these rows are plain strings.
 * Collaborators: ../insightReport.ts, the insight API (apps/server/src/insight/http, the API workstream).
 * Tests: apps/server/test/insight/insightCsvRows.test.ts, apps/server/test/insight/insightSuppression.property.test.ts
 */
import type { InsightCountCell, InsightMedianCell, InsightRateCell } from '@hvl-interaktiv/api-contract';
import type { InsightReport, MisconceptionInsight } from '../insightReport.js';

/** The part of the report a row comes from. */
export type InsightCsvSection = 'participation' | 'items' | 'choices' | 'gaps' | 'video';

/** One CSV row. */
export interface InsightCsvRow {
  readonly section: InsightCsvSection;
  /** The question's `subContentId`; '' for the activity itself or for participation. */
  readonly item: string;
  /** The option or gap number (from 1), or an interaction's second in the video; '' for a whole question. */
  readonly part: string;
  /** The activity's own text, or a wrong answer's text; '' for participation. */
  readonly label: string;
  /** What the value is, as a stable key (e.g. `started`, `firstCorrect`, `wrongAnswer`). */
  readonly measure: string;
  /** A number, `< k` when suppressed, or '' when not available. */
  readonly value: string;
}

type Cell = InsightCountCell | InsightRateCell | InsightMedianCell | null;

/**
 * Writes a cell.
 * @param cell - The cell, or null when not available.
 * @param k - The minimum group size.
 * @param decimals - How many decimals a shown value gets, or undefined to write it as it is.
 * @returns The CSV text of the value.
 */
export function csvValue(cell: Cell, k: number, decimals?: number): string {
  if (cell === null) return '';
  // PRIVACY: a suppressed cell is written as «< k» and carries no value, as in the tab (INS-006, INS-009).
  if (cell.suppressed) return `< ${k}`;
  return decimals === undefined ? String(cell.value) : cell.value.toFixed(decimals);
}

function misconceptionRows(entry: MisconceptionInsight, k: number): InsightCsvRow[] {
  const item = entry.item ?? '';
  const row = (section: InsightCsvSection, part: string, label: string, measure: string, cell: Cell) => ({
    section,
    item,
    part,
    label,
    measure,
    value: csvValue(cell, k),
  });
  if (entry.kind === 'choice') {
    return [
      row('choices', '', entry.questionText, 'learners', entry.learners),
      ...entry.options.map((option) =>
        row(
          'choices',
          String(option.index + 1),
          option.text,
          option.correct ? 'rightOption' : 'wrongOption',
          option.learners,
        ),
      ),
      row('choices', '', '', 'noAnswer', entry.noAnswer),
    ];
  }
  return [
    row('gaps', '', entry.questionText, 'learners', entry.learners),
    ...entry.gaps.flatMap((gap) => {
      const part = String(gap.index + 1);
      return [
        row('gaps', part, gap.correctAnswers.join(' / '), 'gapCorrect', gap.correct),
        ...gap.wrongAnswers.map((wrong) => row('gaps', part, wrong.answer, 'wrongAnswer', wrong.learners)),
        row('gaps', part, '', 'otherWrong', gap.otherWrong),
        row('gaps', part, '', 'empty', gap.empty),
      ];
    }),
  ];
}

/**
 * The CSV rows of a report.
 * @param report - An insight report, already suppressed.
 * @returns Its rows: participation, items (hardest first), choices, gaps, then video interactions.
 * @spec INS-009
 */
export function insightCsvRows(report: InsightReport): InsightCsvRow[] {
  const { k } = report.scope;
  const p = report.participation;
  const participation: [string, Cell, number?][] = [
    ['started', p.started],
    ['completed', p.completed],
    ['completionRate', p.completionRate, 4],
    ['courseLearners', p.courseLearners],
    ['medianMinutesOnTask', p.medianMinutesOnTask],
    ['medianAttempts', p.medianAttempts],
  ];
  return [
    ...participation.map(([measure, cell, decimals]) => ({
      section: 'participation' as const,
      item: '',
      part: '',
      label: '',
      measure,
      value: csvValue(cell, k, decimals),
    })),
    ...report.items.flatMap((entry) =>
      (
        [
          ['learners', entry.learners],
          ['firstCorrect', entry.firstCorrect, 4],
          ['latestCorrect', entry.latestCorrect, 4],
        ] as [string, Cell, number?][]
      ).map(([measure, cell, decimals]) => ({
        section: 'items' as const,
        item: entry.item ?? '',
        part: '',
        label: entry.questionText ?? '',
        measure,
        value: csvValue(cell, k, decimals),
      })),
    ),
    ...report.misconceptions.flatMap((entry) => misconceptionRows(entry, k)),
    ...(report.videoEngagement ?? []).flatMap((entry) =>
      (
        [
          ['answered', entry.answered],
          ['share', entry.share, 4],
        ] as [string, Cell, number?][]
      ).map(([measure, cell, decimals]) => ({
        section: 'video' as const,
        item: entry.item,
        part: entry.atSeconds === null ? '' : String(entry.atSeconds),
        label: entry.label ?? entry.questionText ?? '',
        measure,
        value: csvValue(cell, k, decimals),
      })),
    ),
  ];
}
