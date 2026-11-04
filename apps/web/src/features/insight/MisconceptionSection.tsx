/**
 * MisconceptionSection — INS-003 on the Innsikt tab: each choice and gap question with its first answers, named by its
 * text, with «Ta opp i samlinga» by its heading.
 *
 * Why: INS-003 shows what learners answered first (choice options with the teacher's feedback, the commonest wrong
 *      answers per gap), and a «Ta opp i samlinga» button adds the item to the shortlist for the seminar. Each
 *      question is its own region, so a screen-reader user can move from question to question by heading.
 * Spec: INS-003, INS-008, UD-006
 * Invariants:
 *   - The server's order is kept; a question without first answers in the view is not in the list.
 *   - SPEC-DEVIATION: D-106 — for a content version older than the current one the server sends no distributions
 *     (its options may have changed, D-093), and the section says so instead of "no answers" (D-106's amendment of
 *     2026-11-04).
 *   - A11Y: the section's `h3`, then an `h4` per question; the question's own button names it.
 *   - INS-008: each question says how many learners answered it first, the base its bars are drawn against, so the
 *     table and the text carry what the chart shows; a hidden total shows «< k».
 * Collaborators: ./ChoiceQuestion.tsx, ./GapQuestion.tsx, ./ShortlistButton.tsx, ./CellValue.tsx,
 *   ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightMisconceptions.test.tsx
 */
'use client';

import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { CellValue } from './CellValue';
import { ChoiceQuestion } from './ChoiceQuestion';
import { GapQuestion } from './GapQuestion';
import { KIND } from './insightFormat';
import type { MisconceptionInsight } from './insightReportShape';
import { ShortlistButton } from './ShortlistButton';
import { itemKey } from './shortlistEntries';

/** One question with its heading and shortlist button. */
function Question({ question, k }: { readonly question: MisconceptionInsight; readonly k: number }) {
  const locale = useLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-6 border-t-2 border-hvl-band pt-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h4 id={headingId} className="m-0 text-lg font-bold text-hvl-primary-dark">
          {question.questionText}
        </h4>
        <ShortlistButton itemKey={itemKey(question.item)} question={question.questionText} />
      </div>
      <p className="mb-2">
        {t('insight.misconceptions.learners', locale)}{' '}
        <CellValue cell={question.learners} kind={KIND.count} k={k} />
      </p>
      {question.kind === 'choice' ? (
        <ChoiceQuestion question={question} k={k} />
      ) : (
        <GapQuestion question={question} k={k} />
      )}
    </section>
  );
}

/**
 * The misconceptions section.
 * @param props - The view's misconceptions, k, and whether the view is of an older content version.
 * @returns The section.
 */
export function MisconceptionSection({
  misconceptions,
  k,
  olderVersion,
}: {
  readonly misconceptions: readonly MisconceptionInsight[];
  readonly k: number;
  readonly olderVersion: boolean;
}) {
  const locale = useLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId}>{t('insight.misconceptions.heading', locale)}</h3>
      {olderVersion ? (
        <p>{t('insight.misconceptions.olderVersion', locale)}</p>
      ) : misconceptions.length === 0 ? (
        <p>{t('insight.misconceptions.none', locale)}</p>
      ) : (
        <>
          <p>{t('insight.misconceptions.intro', locale)}</p>
          {misconceptions.map((question) => (
            <Question key={itemKey(question.item)} question={question} k={k} />
          ))}
        </>
      )}
    </section>
  );
}
