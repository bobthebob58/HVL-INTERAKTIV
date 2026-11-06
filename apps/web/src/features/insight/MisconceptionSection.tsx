/**
 * MisconceptionSection — INS-003 on the Innsikt tab: each choice and gap question with its first answers, named by its
 * text, with «Ta opp i samlinga» by its heading.
 *
 * Why: INS-003 shows what learners answered first (choice options with the teacher's feedback, the commonest wrong
 *      answers per gap), and a «Ta opp i samlinga» button adds the item to the shortlist for the seminar. Each
 *      question is its own region, so a screen-reader user can move from question to question by heading.
 * Spec: INS-003, INS-008, UD-006, UD-010
 * Invariants:
 *   - The server's order is kept; a question without first answers in the view is not in the list.
 *   - SPEC-DEVIATION: D-106 — for a content version older than the current one the server sends no distributions
 *     (its options may have changed, D-093), and the section says so instead of "no answers" (D-106's amendment of
 *     2026-11-04).
 *   - A11Y: the section's `h3`, then an `h4` per question; the question's own button names it. The question's text
 *     carries the activity's language when it differs from the page's (UD-010, ./authoredLanguage.tsx). A question
 *     without text is named by its place in the item table («Spørsmål 2 (utan tekst)»), as the shortlist names it,
 *     so no heading or button name is empty (WCAG 1.3.1, 2.4.6).
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
import { useAuthoredLang } from './authoredLanguage';
import { CellValue } from './CellValue';
import { ChoiceQuestion } from './ChoiceQuestion';
import { GapQuestion } from './GapQuestion';
import { KIND } from './insightFormat';
import type { ItemDifficultyInsight, MisconceptionInsight } from './insightReportShape';
import { questionLabel } from './insightSummaries';
import { ShortlistButton } from './ShortlistButton';
import { itemKey } from './shortlistEntries';

/** One question with its heading and shortlist button; `place` is its number in the item table. */
function Question({
  question,
  place,
  k,
}: {
  readonly question: MisconceptionInsight;
  readonly place: number;
  readonly k: number;
}) {
  const locale = useLocale();
  const authoredLang = useAuthoredLang();
  const headingId = useId();
  const name = questionLabel(question.questionText, place, locale);
  const lang = question.questionText ? authoredLang : undefined;
  return (
    <section aria-labelledby={headingId} className="mb-6 border-t-2 border-hvl-band pt-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h4 id={headingId} lang={lang} className="m-0 text-lg font-bold text-hvl-primary-dark">
          {name}
        </h4>
        <ShortlistButton itemKey={itemKey(question.item)} question={name} lang={lang} />
      </div>
      <p className="mb-2">
        {t('insight.misconceptions.learners', locale)}{' '}
        <CellValue cell={question.learners} kind={KIND.count} k={k} />
      </p>
      {question.kind === 'choice' ? (
        <ChoiceQuestion question={question} name={name} k={k} />
      ) : (
        <GapQuestion question={question} k={k} />
      )}
    </section>
  );
}

/**
 * The misconceptions section.
 * @param props - The view's misconceptions, its items (for a question's place), k, and whether the view is of an
 *   older content version.
 * @returns The section.
 */
export function MisconceptionSection({
  misconceptions,
  items,
  k,
  olderVersion,
}: {
  readonly misconceptions: readonly MisconceptionInsight[];
  readonly items: readonly ItemDifficultyInsight[];
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
            <Question
              key={itemKey(question.item)}
              question={question}
              place={items.findIndex((item) => itemKey(item.item) === itemKey(question.item)) + 1}
              k={k}
            />
          ))}
        </>
      )}
    </section>
  );
}
