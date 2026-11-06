/**
 * InsightShortlist — the «Ta opp i samlinga» list of the Innsikt tab: the questions the teacher added, each with a few
 * lines of aggregates and their own feedback, a way to take one off, and the list printed alone or shown in large
 * type for projecting in the seminar.
 *
 * Why: INS-003's «Ta opp i samlinga» adds an item to "a shortlist that can be printed or projected"; spec 05 has
 *      insight prepare the next synchronous session (Just-in-Time Teaching). Printing uses a print stylesheet that
 *      leaves out the page around the list (./insightPrint.css); projecting opens the list in a modal dialog in large
 *      type, which the teacher can show full screen.
 * Spec: INS-003, UD-006, UD-002, UD-010
 * Invariants:
 *   - PRIVACY: the list holds aggregates and the teacher's texts only (./shortlistEntries.ts); so do its printout and
 *     its projection.
 *   - A11Y: a section named by its `h3`; the list is an ordered list; «Ta ut av lista» names its question; after a
 *     removal focus moves to the section's heading, never to `body` (WCAG 2.4.3). The dialog returns focus on close.
 *   - Print and project are offered only when the list has questions.
 *   - A question's own text carries the activity's language, in the list and in the projection (UD-010).
 * Collaborators: ./shortlistContext.tsx, ./printShortlist.ts, ./insightPrint.css, ../../components/Dialog.tsx,
 *   ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/InsightShortlist.test.tsx
 */
'use client';

import { useId, useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useAuthoredLang } from './authoredLanguage';
import './insightPrint.css';
import { printShortlist } from './printShortlist';
import { shortlistCount, useShortlist } from './shortlistContext';
import type { ShortlistEntry } from './shortlistEntries';

/** The questions as an ordered list, in normal or large type. */
function ShortlistItems({
  entries,
  large = false,
  onRemove,
}: {
  readonly entries: readonly ShortlistEntry[];
  readonly large?: boolean;
  readonly onRemove?: (entry: ShortlistEntry) => void;
}) {
  const locale = useLocale();
  const authoredLang = useAuthoredLang();
  return (
    <ol className={`m-0 mb-4 pl-8 ${large ? 'text-2xl' : ''}`}>
      {entries.map((entry) => (
        <li key={entry.key} className="mb-4">
          <p className="m-0 font-bold" lang={entry.authored ? authoredLang : undefined}>
            {entry.question}
          </p>
          <p className="m-0">{entry.view}</p>
          {entry.lines.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
          {onRemove ? (
            <button type="button" className="button-secondary mt-2" onClick={() => onRemove(entry)}>
              {t('insight.shortlist.remove', locale)}
              <span className="sr-only" lang={entry.authored ? authoredLang : undefined}>
                {' '}
                ({entry.question})
              </span>
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The shortlist section.
 * @param props - The activity's title, for the printout's and the projection's heading.
 * @returns The section.
 */
export function InsightShortlist({ title }: { readonly title: string }) {
  const locale = useLocale();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const shortlist = useShortlist();
  const [projecting, setProjecting] = useState(false);
  const listTitle = t('insight.shortlist.title', locale, { title });
  const { entries } = shortlist;

  const remove = (entry: ShortlistEntry) => {
    shortlist.remove(entry.key);
    // A11Y: WCAG 2.4.3: the pressed button is gone; focus goes to the section's heading.
    heading.current?.focus();
  };

  return (
    <section aria-labelledby={headingId} className="insight-shortlist mb-6 border-l-4 border-hvl-accent pl-4">
      <p className="hidden text-2xl font-bold print:block">{listTitle}</p>
      <h3 id={headingId} ref={heading} tabIndex={-1}>
        {t('insight.shortlist.heading', locale)} ({shortlistCount(entries.length, locale)})
      </h3>
      <p className="print:hidden">{t('insight.shortlist.intro', locale)}</p>
      {entries.length === 0 ? (
        <p>{t('insight.shortlist.empty', locale)}</p>
      ) : (
        <>
          <ShortlistItems entries={entries} onRemove={remove} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="button-primary" onClick={() => printShortlist()}>
              {t('insight.shortlist.print', locale)}
            </button>
            <button type="button" className="button-secondary" onClick={() => setProjecting(true)}>
              {t('insight.shortlist.project', locale)}
            </button>
          </div>
        </>
      )}
      <Dialog open={projecting} title={listTitle} onClose={() => setProjecting(false)}>
        <ShortlistItems entries={entries} large />
      </Dialog>
    </section>
  );
}
