/**
 * InsightNotes — the notes the Innsikt tab always shows with its numbers: that the scores are formative; that the
 * tab shows aggregates only, with every value about fewer than k learners hidden as «< k»; and that the numbers run
 * up to and including yesterday, in a period shortened to start on 1 August where it is.
 *
 * Why: CLAUDE.md §1 and D-105 have the insight views say that H5P scores are formative, computed in the browser and
 *      not exam evidence, with PROD-011's notice texts (`notice.formativeUse`), so the two never drift apart. INS-006
 *      and spec 05 §3 have teachers see groups of at least k only; the note says what «< k» means where it appears,
 *      and why a second value can be hidden (the next-smallest cell, INS-006). D-106's amendment of 2026-11-04 ends
 *      every period at the latest midnight in Oslo and starts none before 1 August, and the period note says so, so
 *      a teacher who expects today's plays or a full 7 days is not misled.
 * Spec: LTI-013, PROD-011, INS-006, PROD-010
 * Invariants:
 *   - A11Y: the formative and privacy notes are regions, each named by its own `h3`; icons are `aria-hidden`. The
 *     period note is plain text read right after the scope line it qualifies, so it adds no landmark or heading.
 *   - k is the view's (`scope.k`), never a number written in the text; the period note's dates are the view's own.
 *   - The colours are the notice's information tokens and the band (D-017).
 * Collaborators: ../../components/Notice.tsx (`INFO_ICON`, the same texts), ./insightPeriods.ts,
 *   ../../i18n/formatDate.ts, ./InsightPanel.tsx, ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightPanel.test.tsx, apps/web/test/features/insight/InsightPeriodNote.test.tsx
 */
'use client';

import type { InsightScope } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { INFO_ICON } from '../../components/Notice';
import { formatDate } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { isShortenedPeriod, lastDayOf } from './insightPeriods';

/**
 * The formative note.
 * @returns The labelled note.
 */
export function FormativeInsightNote() {
  const locale = useLocale();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mb-4 bg-hvl-feedback-info-bg p-4 text-hvl-feedback-info-fg">
      <h3 id={titleId} className="text-hvl-feedback-info-fg">
        <span aria-hidden="true">{INFO_ICON} </span>
        {t('notice.formativeUse.title', locale)}
      </h3>
      <p className="mb-0">
        {t('notice.formativeUse.body', locale)} {t('insight.formativeExtra', locale)}
      </p>
    </section>
  );
}

/**
 * The privacy note.
 * @param props - The view's minimum group size.
 * @returns The labelled note.
 */
export function PrivacyInsightNote({ k }: { readonly k: number }) {
  const locale = useLocale();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mb-4 border-l-4 border-hvl-band bg-hvl-surface p-4">
      <h3 id={titleId}>{t('insight.privacy.heading', locale)}</h3>
      <p className="mb-0">{t('insight.privacy.body', locale, { k })}</p>
    </section>
  );
}

/**
 * The period note: the numbers run up to and including yesterday, and, where it applies, the period starts on
 * 1 August because the learners' keys change then (D-106's amendment of 2026-11-04).
 * @param props - The view's scope.
 * @returns One or two paragraphs.
 */
export function PeriodInsightNote({ scope }: { readonly scope: InsightScope }) {
  const locale = useLocale();
  return (
    <>
      <p>
        {t('insight.period.throughYesterday', locale, {
          last: formatDate(lastDayOf(scope.periodEnd), locale),
        })}
      </p>
      {isShortenedPeriod(scope) ? (
        <p>{t('insight.period.shortened', locale, { start: formatDate(scope.periodStart, locale) })}</p>
      ) : null}
    </>
  );
}
