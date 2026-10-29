/**
 * PlannerTable — the alignment planner's grid for one course: learning outcomes × phases, each cell listing the
 * author's activities, an empty cell offering «Lag frå mønster».
 *
 * Why: PED-031 must be "an accessible HTML table with row and column headers, not only a visual canvas". D-088 fixes
 *      the markup: a `<table>` with a `<caption>`, `th scope="col"` for the phases, `th scope="row"` for the outcomes,
 *      inside a focusable, labelled region that scrolls sideways on narrow screens (WCAG 1.4.10, 2.1.1).
 * Spec: PED-031, UD-003, UD-008, UD-010
 * Invariants:
 *   - Phase headers are the content's labels in the page's language (PED-001), in the planner's column order.
 *   - An activity's status is said in text with its icon (`StatusBadge`), and its title carries its own language.
 *   - An empty cell links to the catalogue filtered by its phase and carrying the course; the link's accessible name
 *     starts with its visible text and names the phase and the outcome (WCAG 2.4.4, 2.5.3).
 *   - The etterarbeid cell of an outcome without one says "Hol" with an icon, never by colour alone (D-088).
 * Collaborators: ./PlannerWorkspace.tsx, ../../components/StatusBadge.tsx, ../../config/paths.ts,
 *   ../learningDesign/OutcomeFields.tsx (`CATEGORY_LABEL`), ../../i18n/partLanguage.ts.
 * Tests: apps/web/test/features/PlannerTable.test.tsx
 */
'use client';

import type { PhaseKey, Planner, PlannerCell } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { SEVERITY_ICON } from '../../components/FindingsList';
import { StatusBadge } from '../../components/StatusBadge';
import { activityPath, catalogueHref } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { partLanguage } from '../../i18n/partLanguage';
import { t } from '../../i18n/translate';
import { CATEGORY_LABEL } from '../learningDesign/OutcomeFields';

/** The phase whose absence for an outcome is a gap (D-088). */
const CONSOLIDATION_PHASE: PhaseKey = 'etterarbeid';

/** What the table needs. */
export interface PlannerTableProps {
  readonly planner: Planner;
  /** Each phase's label from content, in the page's language. */
  readonly phaseLabel: (phase: PhaseKey) => string;
}

/**
 * The planner's table.
 * @param props - The planner and the phase labels.
 * @returns The labelled, scrollable region with the table.
 */
export function PlannerTable({ planner, phaseLabel }: PlannerTableProps) {
  const locale = useLocale();
  const captionId = useId();
  const course = planner.courseCode;
  const cellContent = (cell: PlannerCell, outcome: string, gap: boolean) =>
    cell.activities.length > 0 ? (
      <ul className="m-0 list-none p-0">
        {cell.activities.map((activity) => (
          <li key={activity.contentId} className="mb-1">
            <a href={activityPath(activity.contentId)} lang={partLanguage(activity.language, locale)}>
              {activity.title}
            </a>{' '}
            <StatusBadge status={activity.status} locale={locale} />
          </li>
        ))}
      </ul>
    ) : (
      <>
        {gap ? (
          <p className="m-0 font-bold">
            <span aria-hidden="true">{SEVERITY_ICON.warning} </span>
            {t('planner.gapCell', locale)}
          </p>
        ) : null}
        <a href={catalogueHref({ phase: cell.phase, course })}>
          {t('planner.createFromPattern', locale)}
          <span className="sr-only">
            {' '}
            {t('planner.createFromPatternContext', locale, { phase: phaseLabel(cell.phase), outcome })}
          </span>
        </a>
      </>
    );
  return (
    <div role="region" aria-labelledby={captionId} tabIndex={0} className="mb-6 overflow-x-auto">
      <table className="min-w-2xl border-collapse text-left">
        <caption id={captionId} className="mb-2 text-left text-lg font-bold">
          {t('planner.caption', locale, { course })}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border border-hvl-ink-muted bg-hvl-band p-2">
              {t('planner.outcomeColumn', locale)}
            </th>
            {planner.phases.map((phase) => (
              <th key={phase} scope="col" className="border border-hvl-ink-muted bg-hvl-band p-2">
                {phaseLabel(phase)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planner.rows.map((row) => {
            const gap = !row.cells.some(
              (cell) => cell.phase === CONSOLIDATION_PHASE && cell.activities.length > 0,
            );
            return (
              <tr key={`${row.outcome.category}|${row.outcome.text}`}>
                <th scope="row" className="border border-hvl-ink-muted p-2 align-top font-normal">
                  <span className="block font-bold">{row.outcome.text}</span>
                  <span className="block">{t(CATEGORY_LABEL[row.outcome.category], locale)}</span>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.phase} className="border border-hvl-ink-muted p-2 align-top">
                    {cellContent(cell, row.outcome.text, gap && cell.phase === CONSOLIDATION_PHASE)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
