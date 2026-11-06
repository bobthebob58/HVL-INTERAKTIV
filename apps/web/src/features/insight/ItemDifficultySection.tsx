/**
 * ItemDifficultySection — INS-002 on the Innsikt tab: every question, hardest first, with the share correct on the
 * first and on the latest attempt and the number of learners, as a summary sentence, a bar chart and a data table
 * with the question text and «Ta opp i samlinga».
 *
 * Why: INS-002 sorts items hardest first and shows the question text so the teacher need not open the editor; INS-008
 *      gives the chart a visible data table and a one-sentence summary, and D-106 draws it in one hue with each value
 *      written by its bar (the latest attempt striped). INS-003's shortlist button sits in each row.
 * Spec: INS-002, INS-008, INS-006, INS-003, UD-003, UD-010
 * Invariants:
 *   - The server's order is kept (hardest first; hidden or unknown shares last); the number in the chart and the
 *     table is the place in that order.
 *   - A suppressed share has no bar and shows «< k»; a share that cannot be judged shows «Ikkje tilgjengeleg».
 *   - A11Y: a figure whose caption is the summary; the chart is `aria-hidden`, the table carries every value. A
 *     question's own text carries the activity's language (UD-010); the name of one without text does not.
 * Collaborators: ./BarChart.tsx, ./ScrollTable.tsx, ./CellValue.tsx, ./insightSummaries.ts, ./ShortlistButton.tsx,
 *   ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightCharts.test.tsx
 */
'use client';

import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useAuthoredLang } from './authoredLanguage';
import { BarChart, SOLID, STRIPED, type ChartRow } from './BarChart';
import { CellValue } from './CellValue';
import { cellText, shownValue, KIND } from './insightFormat';
import type { ItemDifficultyInsight } from './insightReportShape';
import { itemsSummary, questionLabel } from './insightSummaries';
import { DATA_CELL, HEAD_CELL, ROW_HEAD_CELL, ScrollTable } from './ScrollTable';
import { ShortlistButton } from './ShortlistButton';
import { itemKey } from './shortlistEntries';

/**
 * The item difficulty section.
 * @param props - The items, hardest first, and k.
 * @returns The section.
 */
export function ItemDifficultySection({
  items,
  k,
}: {
  readonly items: readonly ItemDifficultyInsight[];
  readonly k: number;
}) {
  const locale = useLocale();
  const authoredLang = useAuthoredLang();
  const headingId = useId();
  const rows: ChartRow[] = items.map((item, index) => ({
    key: itemKey(item.item),
    label: t('insight.items.short', locale, { number: index + 1 }),
    bars: [
      {
        pattern: SOLID,
        fraction: shownValue(item.firstCorrect),
        text: cellText(item.firstCorrect, 'percent', k, locale),
      },
      {
        pattern: STRIPED,
        fraction: shownValue(item.latestCorrect),
        text: cellText(item.latestCorrect, 'percent', k, locale),
      },
    ],
  }));
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId}>{t('insight.items.heading', locale)}</h3>
      {items.length === 0 ? (
        <p>{t('insight.items.none', locale)}</p>
      ) : (
        <figure className="m-0">
          <figcaption className="mb-3">
            {t('insight.items.intro', locale)} <strong>{itemsSummary(items, k, locale)}</strong>
          </figcaption>
          <BarChart
            rows={rows}
            legend={[
              { pattern: SOLID, label: t('insight.items.legendFirst', locale) },
              { pattern: STRIPED, label: t('insight.items.legendLatest', locale) },
            ]}
          />
          <ScrollTable caption={t('insight.items.caption', locale)}>
            <thead>
              <tr>
                <th scope="col" className={HEAD_CELL}>
                  {t('insight.items.colNumber', locale)}
                </th>
                <th scope="col" className={HEAD_CELL}>
                  {t('insight.items.colQuestion', locale)}
                </th>
                <th scope="col" className={HEAD_CELL}>
                  {t('insight.items.colLearners', locale)}
                </th>
                <th scope="col" className={HEAD_CELL}>
                  {t('insight.items.colFirst', locale)}
                </th>
                <th scope="col" className={HEAD_CELL}>
                  {t('insight.items.colLatest', locale)}
                </th>
                <th scope="col" className={HEAD_CELL}>
                  {t('insight.items.colShortlist', locale)}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const question = questionLabel(item.questionText, index + 1, locale);
                const lang = item.questionText ? authoredLang : undefined;
                return (
                  <tr key={itemKey(item.item)}>
                    <td className={DATA_CELL}>{index + 1}</td>
                    <th scope="row" className={ROW_HEAD_CELL} lang={lang}>
                      {question}
                    </th>
                    <td className={DATA_CELL}>
                      <CellValue cell={item.learners} kind={KIND.count} k={k} />
                    </td>
                    <td className={DATA_CELL}>
                      <CellValue cell={item.firstCorrect} kind={KIND.percent} k={k} />
                    </td>
                    <td className={DATA_CELL}>
                      <CellValue cell={item.latestCorrect} kind={KIND.percent} k={k} />
                    </td>
                    <td className={DATA_CELL}>
                      <ShortlistButton itemKey={itemKey(item.item)} question={question} lang={lang} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScrollTable>
        </figure>
      )}
    </section>
  );
}
