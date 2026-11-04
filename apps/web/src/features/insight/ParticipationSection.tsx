/**
 * ParticipationSection — INS-001 on the Innsikt tab: learners who started and completed, the completion rate and what
 * it is a share of, the median time on the activity and the median number of attempts.
 *
 * Why: INS-001 shows started, completed, the completion rate (of the course's learners from NRPS when known, LTI-008,
 *      otherwise of those who started), median time on task and median attempts. D-115 says what each reads: where a
 *      type sends no final result, completed, the rate and attempts are "not available", never 0, and the time counts
 *      from the first to the last stored answer of each visit, which the note says.
 * Spec: INS-001, INS-006, LTI-008, UD-003
 * Invariants:
 *   - A11Y: a description list, so each number is read with its name (WCAG 1.3.1); no chart, so no table is needed.
 *   - A suppressed value shows «< k» (./CellValue.tsx); a null value «Ikkje tilgjengeleg» and, once, why.
 *   - The rate always names its base: the course (with its learner count) or those who started.
 * Collaborators: ./CellValue.tsx, ./insightReportShape.ts, ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightPanel.test.tsx
 */
'use client';

import { useId, type ReactNode } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { CellValue } from './CellValue';
import { cellText, KIND } from './insightFormat';
import type { ParticipationInsight } from './insightReportShape';

/** One named value. */
function Tile({ name, children }: { readonly name: string; readonly children: ReactNode }) {
  return (
    <div className="border-l-4 border-hvl-accent bg-hvl-surface p-3">
      <dt>{name}</dt>
      <dd className="m-0 text-2xl font-bold">{children}</dd>
    </div>
  );
}

/**
 * The participation section.
 * @param props - The view's participation, whether the type sends a final result, and k.
 * @returns The section.
 */
export function ParticipationSection({
  participation,
  sendsRootResult,
  k,
}: {
  readonly participation: ParticipationInsight;
  readonly sendsRootResult: boolean;
  readonly k: number;
}) {
  const locale = useLocale();
  const headingId = useId();
  const p = participation;
  const base =
    p.completionBase === 'course'
      ? t('insight.participation.baseCourse', locale, {
          count: cellText(p.courseLearners, 'count', k, locale),
        })
      : p.completionBase === 'started'
        ? t('insight.participation.baseStarted', locale)
        : null;
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId}>{t('insight.participation.heading', locale)}</h3>
      <dl className="m-0 mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Tile name={t('insight.participation.started', locale)}>
          <CellValue cell={p.started} kind={KIND.count} k={k} />
        </Tile>
        <Tile name={t('insight.participation.completed', locale)}>
          <CellValue cell={p.completed} kind={KIND.count} k={k} />
        </Tile>
        <Tile name={t('insight.participation.completionRate', locale)}>
          <CellValue cell={p.completionRate} kind={KIND.percent} k={k} />
          {base && p.completionRate ? (
            <>
              {' '}
              <span className="block text-base font-normal">{base}</span>
            </>
          ) : null}
        </Tile>
        <Tile name={t('insight.participation.medianMinutes', locale)}>
          <CellValue cell={p.medianMinutesOnTask} kind={KIND.minutes} k={k} />
        </Tile>
        <Tile name={t('insight.participation.medianAttempts', locale)}>
          <CellValue cell={p.medianAttempts} kind={KIND.median} k={k} />
        </Tile>
      </dl>
      {sendsRootResult ? null : <p>{t('insight.participation.noRootResult', locale)}</p>}
      <p>{t('insight.participation.timeNote', locale)}</p>
    </section>
  );
}
