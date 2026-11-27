/**
 * RepetitionSuggestion — the block on **Sjekk og publiser** that suggests when to repeat a published *Etterarbeid*
 * activity, with the one-press copy to place in a later Canvas module.
 *
 * Why: PROD-014. Practice lasts longest when it is spread over time, so the author of an *Etterarbeid* activity is
 *      shown two dates to repeat it on and gets a copy in one press. A copy, not the same activity placed again: a
 *      learner's saved answers belong to the activity and the course, so the same activity would open with the
 *      answers of the first round, and a copy gets a grade column and an insight view of its own (D-152).
 * Spec: PROD-014, UD-006, UD-010
 * Invariants:
 *   - PEDAGOGY: the block advises and never acts by itself: no reminder is set, nothing is stored, nothing is shown
 *     to students, and the dates are read from the time of publishing each time (./repetitionDates.ts).
 *   - A11Y: a labelled region with a heading of its own; each date is a `<time>` with the calendar day, written
 *     with its weekday in the page's language; no meaning is carried by colour.
 *   - The copy is the studio's own (../sharing/DuplicateButton.tsx): a draft that only its maker sees, opened on
 *     its **Rediger** tab; the server decides who may copy and how often.
 * Collaborators: ./repetitionDates.ts, ../sharing/DuplicateButton.tsx, ../../i18n/formatDate.ts,
 *   ../activity/tabs/CheckTab.tsx (decides when the block shows).
 * Tests: apps/web/test/features/RepetitionSuggestion.test.tsx, apps/web/test/features/CheckTabRepetition.test.tsx
 */
'use client';

import { useId } from 'react';
import { formatLongDate } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { DuplicateButton } from '../sharing/DuplicateButton';
import { repetitionDates } from './repetitionDates';

/** What the block needs. */
export interface RepetitionSuggestionProps {
  /** The published activity. */
  readonly contentId: string;
  /** When it was last published, an ISO 8601 date-time from the API. */
  readonly publishedAt: string;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
  /** Opens a page; the browser's own navigation by default. */
  readonly navigate?: (path: string) => void;
}

/**
 * The repetition suggestion.
 * @param props - The activity, its time of publishing, the page's announcer and the navigation.
 * @returns A region with the suggested dates and the copy button.
 */
export function RepetitionSuggestion({
  contentId,
  publishedAt,
  announce,
  navigate,
}: RepetitionSuggestionProps) {
  const locale = useLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h3 id={headingId}>{t('repetition.heading', locale)}</h3>
      <p>{t('repetition.intro', locale)}</p>
      <ul className="mb-3 list-disc pl-6">
        {repetitionDates(publishedAt).map(({ days, date }) => (
          <li key={days}>
            <time dateTime={date}>{formatLongDate(date, locale)}</time>{' '}
            {t('repetition.after', locale, { days })}
          </li>
        ))}
      </ul>
      <p>{t('repetition.countFrom', locale)}</p>
      <p className="mb-0">{t('repetition.copyNote', locale)}</p>
      <DuplicateButton contentId={contentId} announce={announce} {...(navigate ? { navigate } : {})} />
    </section>
  );
}
