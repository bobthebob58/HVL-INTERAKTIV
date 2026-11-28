/**
 * BranchingSection — INS-004 on the Innsikt tab of a Branching Scenario: for each decision, how many learners chose
 * each option the first time they met it, as a summary sentence, a bar chart and a table, and how many chose again.
 *
 * Why: a scenario lets the learner decide and shows the consequence. Which option most learners take first, and how
 *      many come back to decide again, tells the teacher what to take up in the seminar (INS-004). INS-008 gives
 *      each chart a visible table and a summary.
 * Spec: INS-004, INS-008, INS-006, UD-010
 * Invariants:
 *   - Shown only when the view has decisions (a Branching Scenario); the server's order of decisions and options is
 *     kept. An older version says why it has none; a scenario without decisions says so.
 *   - PRIVACY: only what the view holds is shown: counts per option and two counts of learners per decision, each
 *     «< k» when the server hid it. Nothing joins two decisions, and nothing is about one learner (D-154).
 *   - A hidden count has no bar. A bar is a share of the decision's shown learners, else of its largest shown count.
 *   - The table has two columns and fits a phone's width with its texts wrapped (./ScrollTable.tsx `fit`).
 *   - A11Y: each decision is a figure whose caption is the summary; the chart is `aria-hidden`, the table carries
 *     every value. The question and the options carry the activity's language (UD-010), in the heading, the table
 *     and where a sentence quotes them (./quotedText.tsx); a decision or option without text is named by its place.
 * Collaborators: ./BarChart.tsx, ./ScrollTable.tsx, ./CellValue.tsx, ./ChoiceQuestion.tsx (`barBase`),
 *   ./insightSummaries.ts, ./quotedText.tsx, ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightBranching.test.tsx
 */
'use client';

import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useAuthoredLang } from './authoredLanguage';
import { BarChart, SOLID, type ChartRow } from './BarChart';
import { CellValue } from './CellValue';
import { barBase } from './ChoiceQuestion';
import { cellText, shownValue, KIND } from './insightFormat';
import type { BranchingDecisionInsight } from './insightReportShape';
import { decisionLabel, decisionSummary, optionLabel } from './insightSummaries';
import { Quoted, quotedSentence } from './quotedText';
import { DATA_CELL, HEAD_CELL, ROW_HEAD_CELL, ScrollTable } from './ScrollTable';

/** One decision; `place` is its number among the scenario's decisions. */
function Decision({
  decision,
  place,
  k,
}: {
  readonly decision: BranchingDecisionInsight;
  readonly place: number;
  readonly k: number;
}) {
  const locale = useLocale();
  const authoredLang = useAuthoredLang();
  const headingId = useId();
  const authored = decision.questionText !== '';
  const name = decisionLabel(decision.questionText, place, locale);
  const caption = quotedSentence(
    'insight.branching.caption',
    locale,
    { question: name },
    authored ? 'question' : undefined,
  );
  const base = barBase(
    decision.learners,
    decision.options.map((option) => option.learners),
  );
  const rows: ChartRow[] = decision.options.map((option) => {
    const value = shownValue(option.learners);
    return {
      key: `o${option.index}`,
      label: optionLabel(option, locale),
      authored: option.text !== '',
      bars: [
        {
          pattern: SOLID,
          fraction: value === undefined ? undefined : value / base,
          text: cellText(option.learners, 'count', k, locale),
        },
      ],
    };
  });
  return (
    <section aria-labelledby={headingId} className="mb-6 border-t-2 border-hvl-band pt-3">
      <h4
        id={headingId}
        lang={authored ? authoredLang : undefined}
        className="m-0 mb-2 text-lg font-bold text-hvl-primary-dark"
      >
        {name}
      </h4>
      <p className="mb-2">
        {t('insight.branching.learners', locale)}{' '}
        <CellValue cell={decision.learners} kind={KIND.count} k={k} />
      </p>
      <figure className="m-0 mb-2">
        <figcaption className="mb-2 font-bold">
          <Quoted value={decisionSummary(decision, locale)} />
        </figcaption>
        <BarChart rows={rows} />
        <ScrollTable caption={<Quoted value={caption} />} fit>
          <thead>
            <tr>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.branching.colOption', locale)}
              </th>
              <th scope="col" className={HEAD_CELL}>
                {t('insight.branching.colLearners', locale)}
              </th>
            </tr>
          </thead>
          <tbody>
            {decision.options.map((option) => (
              <tr key={option.index}>
                <th scope="row" className={ROW_HEAD_CELL} lang={option.text ? authoredLang : undefined}>
                  {optionLabel(option, locale)}
                </th>
                <td className={DATA_CELL}>
                  <CellValue cell={option.learners} kind={KIND.count} k={k} />
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </figure>
      <p>
        {t('insight.branching.choseAgain', locale)}{' '}
        <CellValue cell={decision.choseAgain} kind={KIND.count} k={k} />
      </p>
    </section>
  );
}

/**
 * The decisions section.
 * @param props - The view's decisions in the scenario's order, k, and whether the view is of an older content
 *   version.
 * @returns The section.
 */
export function BranchingSection({
  decisions,
  k,
  olderVersion,
}: {
  readonly decisions: readonly BranchingDecisionInsight[];
  readonly k: number;
  readonly olderVersion: boolean;
}) {
  const locale = useLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId}>{t('insight.branching.heading', locale)}</h3>
      {olderVersion ? (
        <p>{t('insight.branching.olderVersion', locale)}</p>
      ) : decisions.length === 0 ? (
        <p>{t('insight.branching.none', locale)}</p>
      ) : (
        <>
          <p>{t('insight.branching.intro', locale)}</p>
          {decisions.map((decision, index) => (
            <Decision key={decision.item} decision={decision} place={index + 1} k={k} />
          ))}
        </>
      )}
    </section>
  );
}
