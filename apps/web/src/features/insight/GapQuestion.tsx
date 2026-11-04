/**
 * GapQuestion — INS-003 for a Blanks or DragText task: for each gap, the answers the author accepts, how many learners
 * answered right first, the commonest wrong answers (at most five, each given by at least k learners), the other wrong
 * answers and the empty gaps, as a summary sentence, a bar chart and a data table.
 *
 * Why: INS-003 shows the most frequent wrong answers per gap, trimmed, case-folded and limited to five, and a free-text
 *      answer only when at least k distinct learners gave it, so a rare and identifiable answer is never shown; the
 *      server has already left those out and counts them under «Andre feil svar». INS-008 gives the chart a visible
 *      table and a summary.
 * Spec: INS-003, INS-008, INS-006
 * Invariants:
 *   - PRIVACY: a wrong answer appears only as the server listed it; the tab adds none.
 *   - Rows: the right answers, each listed wrong answer most frequent first, the other wrong answers, empty gaps.
 *   - A suppressed count has no bar and shows «< k».
 *   - A11Y: each gap is named by its own `h5` heading, under the question's `h4`.
 * Collaborators: ./BarChart.tsx, ./ScrollTable.tsx, ./CellValue.tsx, ./insightSummaries.ts, ./ChoiceQuestion.tsx
 *   (`barBase`), ./MisconceptionSection.tsx.
 * Tests: apps/web/test/features/insight/InsightMisconceptions.test.tsx
 */
'use client';

import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type Locale } from '../../i18n/translate';
import { BarChart, SOLID, type ChartRow } from './BarChart';
import { CellValue } from './CellValue';
import { barBase } from './ChoiceQuestion';
import { acceptedAnswers, cellText, shownValue, type AnyCell, KIND } from './insightFormat';
import type { GapInsight, GapMisconception } from './insightReportShape';
import { gapSummary } from './insightSummaries';
import { DATA_CELL, HEAD_CELL, ROW_HEAD_CELL, ScrollTable } from './ScrollTable';

/** One gap's rows. */
function gapRows(gap: GapInsight, locale: Locale): { key: string; label: string; cell: AnyCell }[] {
  return [
    { key: 'correct', label: t('insight.gaps.correct', locale), cell: gap.correct },
    ...gap.wrongAnswers.map((wrong, index) => ({
      key: `w${index}`,
      label: wrong.answer,
      cell: wrong.learners,
    })),
    { key: 'other', label: t('insight.gaps.otherWrong', locale), cell: gap.otherWrong },
    { key: 'empty', label: t('insight.gaps.empty', locale), cell: gap.empty },
  ];
}

/** One gap. */
function Gap({
  gap,
  learners,
  k,
}: {
  readonly gap: GapInsight;
  readonly learners: AnyCell;
  readonly k: number;
}) {
  const locale = useLocale();
  const headingId = useId();
  const number = gap.index + 1;
  const rowsOf = gapRows(gap, locale);
  const base = barBase(
    learners,
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
    <section aria-labelledby={headingId} className="mb-4">
      <h5 id={headingId} className="m-0 mb-1 text-base font-bold">
        {t('insight.gaps.heading', locale, { number })}
      </h5>
      <p className="mb-2">
        {t('insight.gaps.accepted', locale, { answers: acceptedAnswers(gap.correctAnswers, locale) })}
      </p>
      <figure className="m-0">
        <figcaption className="mb-2 font-bold">{gapSummary(gap, locale)}</figcaption>
        <BarChart rows={rows} />
        <ScrollTable caption={t('insight.gaps.caption', locale, { number })}>
          <thead>
            <tr>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.gaps.colAnswer', locale)}
              </th>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.gaps.colLearners', locale)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsOf.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={ROW_HEAD_CELL}>
                  {row.label}
                </th>
                <td className={DATA_CELL}>
                  <CellValue cell={row.cell} kind={KIND.count} k={k} />
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </figure>
    </section>
  );
}

/**
 * The gaps of one task.
 * @param props - The task's gaps and k.
 * @returns One section per gap.
 */
export function GapQuestion({ question, k }: { readonly question: GapMisconception; readonly k: number }) {
  return (
    <>
      {question.gaps.map((gap) => (
        <Gap key={gap.index} gap={gap} learners={question.learners} k={k} />
      ))}
    </>
  );
}
