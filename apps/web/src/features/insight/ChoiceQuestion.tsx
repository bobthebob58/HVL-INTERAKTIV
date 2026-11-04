/**
 * ChoiceQuestion — INS-003 for one choice question: how many learners chose each option first, whether the option is
 * right or wrong in words and an icon, and the teacher's own feedback by each wrong option, as a summary sentence, a
 * bar chart and a data table.
 *
 * Why: INS-003 shows the distribution across options with the teacher's feedback for each wrong option next to it, so
 *      the seminar can start from the commonest misconception. INS-008 gives the chart a visible table and a summary;
 *      UD-003 and CLAUDE.md §1 never let right or wrong rest on colour: «✓ Riktig» and «✗ Feil» are written out.
 * Spec: INS-003, INS-008, INS-006, UD-003
 * Invariants:
 *   - A suppressed count (fewer than k learners, or hidden so a total cannot reveal it) has no bar and shows «< k».
 *   - Bars are a share of the learners who answered, or of the largest shown count when that total is hidden.
 *   - «Ingen av alternativa» (first answers that name no current option) has a row only when it is not 0.
 *   - The icons are `aria-hidden`; the words carry the meaning.
 * Collaborators: ./BarChart.tsx, ./ScrollTable.tsx, ./CellValue.tsx, ./insightSummaries.ts,
 *   ./MisconceptionSection.tsx.
 * Tests: apps/web/test/features/insight/InsightMisconceptions.test.tsx
 */
'use client';

import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { BarChart, SOLID, type ChartRow } from './BarChart';
import { CellValue } from './CellValue';
import { cellText, shownValue, type AnyCell, KIND } from './insightFormat';
import type { ChoiceMisconception } from './insightReportShape';
import { choiceSummary } from './insightSummaries';
import { DATA_CELL, HEAD_CELL, ROW_HEAD_CELL, ScrollTable } from './ScrollTable';

/** The icon before a right and a wrong option (UD-003); always followed by its word. */
export const OPTION_ICON = { correct: '✓', wrong: '✗' } as const;

/**
 * The length of each bar: a share of the shown total, else of the largest shown count.
 * @param total - The learners who answered.
 * @param cells - The counts drawn.
 * @returns The divisor, at least 1.
 */
export function barBase(total: AnyCell, cells: readonly AnyCell[]): number {
  const largest = Math.max(0, ...cells.map((cell) => shownValue(cell) ?? 0));
  return Math.max(1, shownValue(total) ?? largest);
}

/**
 * One choice question's distribution.
 * @param props - The question and k.
 * @returns The figure.
 */
export function ChoiceQuestion({
  question,
  k,
}: {
  readonly question: ChoiceMisconception;
  readonly k: number;
}) {
  const locale = useLocale();
  const showNoAnswer = shownValue(question.noAnswer) !== 0;
  const rowsOf = [
    ...question.options.map((option) => ({
      key: `o${option.index}`,
      label: option.text,
      cell: option.learners,
    })),
    ...(showNoAnswer
      ? [{ key: 'none', label: t('insight.choice.noAnswer', locale), cell: question.noAnswer }]
      : []),
  ];
  const base = barBase(
    question.learners,
    rowsOf.map((row) => row.cell),
  );
  const rows: ChartRow[] = rowsOf.map((row) => {
    const value = shownValue(row.cell);
    return {
      key: row.key,
      label: row.label,
      bars: [
        {
          pattern: SOLID,
          fraction: value === undefined ? undefined : value / base,
          text: cellText(row.cell, 'count', k, locale),
        },
      ],
    };
  });
  return (
    <figure className="m-0 mb-4">
      <figcaption className="mb-2 font-bold">{choiceSummary(question, locale)}</figcaption>
      <BarChart rows={rows} />
      <ScrollTable caption={t('insight.choice.caption', locale, { question: question.questionText })}>
        <thead>
          <tr>
            <th scope="col" className={HEAD_CELL}>
              {t('insight.choice.colOption', locale)}
            </th>
            <th scope="col" className={HEAD_CELL}>
              {t('insight.choice.colCorrect', locale)}
            </th>
            <th scope="col" className={HEAD_CELL}>
              {t('insight.choice.colLearners', locale)}
            </th>
            <th scope="col" className={HEAD_CELL}>
              {t('insight.choice.colFeedback', locale)}
            </th>
          </tr>
        </thead>
        <tbody>
          {question.options.map((option) => (
            <tr key={option.index}>
              <th scope="row" className={ROW_HEAD_CELL}>
                {option.text}
              </th>
              <td className={DATA_CELL}>
                <span
                  className={`font-bold ${option.correct ? 'text-hvl-feedback-correct-fg' : 'text-hvl-feedback-incorrect-fg'}`}
                >
                  <span aria-hidden="true">{option.correct ? OPTION_ICON.correct : OPTION_ICON.wrong} </span>
                  {t(option.correct ? 'insight.choice.correct' : 'insight.choice.wrong', locale)}
                </span>
              </td>
              <td className={DATA_CELL}>
                <CellValue cell={option.learners} kind={KIND.count} k={k} />
              </td>
              <td className={DATA_CELL}>
                {option.correct ? null : (option.feedback ?? t('insight.choice.noFeedback', locale))}
              </td>
            </tr>
          ))}
          {showNoAnswer ? (
            <tr>
              <th scope="row" className={ROW_HEAD_CELL}>
                {t('insight.choice.noAnswer', locale)}
              </th>
              <td className={DATA_CELL} />
              <td className={DATA_CELL}>
                <CellValue cell={question.noAnswer} kind={KIND.count} k={k} />
              </td>
              <td className={DATA_CELL} />
            </tr>
          ) : null}
        </tbody>
      </ScrollTable>
    </figure>
  );
}
