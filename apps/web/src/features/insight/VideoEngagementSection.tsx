/**
 * VideoEngagementSection — INS-005 on the Innsikt tab of an InteractiveVideo: for each task in the video, in time
 * order, the share of the learners who started that answered it, as a summary sentence, a bar chart and a table.
 *
 * Why: INS-005 (COULD) uses the share who answered each interaction as a proxy for how far learners watched; D-115
 *      found no `progressed` statement, so there is no drop-off curve, only this measure. INS-008 gives the chart a
 *      visible table and a summary.
 * Spec: INS-005, INS-008, INS-006, UD-010
 * Invariants:
 *   - Shown only when the view has video engagement (an InteractiveVideo); the server's order is kept.
 *   - A suppressed share has no bar and shows «< k»; the summary task at the end is at «Slutten».
 *   - A11Y: a figure whose caption is the summary; the chart is `aria-hidden`, the table carries every value. A
 *     task's own label or question carries the activity's language (UD-010); «Oppgåve utan tittel» does not.
 * Collaborators: ./BarChart.tsx, ./ScrollTable.tsx, ./CellValue.tsx, ./insightSummaries.ts, ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightCharts.test.tsx
 */
'use client';

import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useAuthoredLang } from './authoredLanguage';
import { BarChart, SOLID, type ChartRow } from './BarChart';
import { CellValue } from './CellValue';
import { cellText, shownValue, videoTime, KIND } from './insightFormat';
import type { VideoInteractionInsight } from './insightReportShape';
import { interactionName, videoSummary } from './insightSummaries';
import { DATA_CELL, HEAD_CELL, ROW_HEAD_CELL, ScrollTable } from './ScrollTable';

/**
 * The video engagement section.
 * @param props - The interactions in time order, and k.
 * @returns The section.
 */
export function VideoEngagementSection({
  interactions,
  k,
}: {
  readonly interactions: readonly VideoInteractionInsight[];
  readonly k: number;
}) {
  const locale = useLocale();
  const authoredLang = useAuthoredLang();
  const headingId = useId();
  const rows: ChartRow[] = interactions.map((interaction) => ({
    key: interaction.item,
    label: videoTime(interaction.atSeconds, locale),
    bars: [
      {
        pattern: SOLID,
        fraction: shownValue(interaction.share),
        text: cellText(interaction.share, 'percent', k, locale),
      },
    ],
  }));
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId}>{t('insight.video.heading', locale)}</h3>
      <figure className="m-0">
        <figcaption className="mb-3">
          {t('insight.video.intro', locale)} <strong>{videoSummary(interactions, locale)}</strong>
        </figcaption>
        <BarChart rows={rows} />
        <ScrollTable caption={t('insight.video.caption', locale)}>
          <thead>
            <tr>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.video.colTime', locale)}
              </th>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.video.colTask', locale)}
              </th>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.video.colAnswered', locale)}
              </th>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.video.colShare', locale)}
              </th>
            </tr>
          </thead>
          <tbody>
            {interactions.map((interaction) => (
              <tr key={interaction.item}>
                <td className={DATA_CELL}>{videoTime(interaction.atSeconds, locale)}</td>
                <th
                  scope="row"
                  className={ROW_HEAD_CELL}
                  lang={(interaction.label ?? interaction.questionText) === null ? undefined : authoredLang}
                >
                  {interactionName(interaction, locale)}
                </th>
                <td className={DATA_CELL}>
                  <CellValue cell={interaction.answered} kind={KIND.count} k={k} />
                </td>
                <td className={DATA_CELL}>
                  <CellValue cell={interaction.share} kind={KIND.percent} k={k} />
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </figure>
    </section>
  );
}
