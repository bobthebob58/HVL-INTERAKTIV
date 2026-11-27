/**
 * shortlistContext — the «Ta opp i samlinga» list of the Innsikt tab: which questions are on it, and adding or taking
 * one off from any section of the tab, each change said in the tab's status region.
 *
 * Why: INS-003 puts a «Ta opp i samlinga» button by each question, in the item table and by each misconception, and
 *      one shortlist below them collects what was added, for printing or projecting. A context shares the list between
 *      the buttons and the list without passing it through every section. The list lives in the page's memory only,
 *      and holds words about the group, never a row about one learner: aggregates, the teacher's texts and typed gap
 *      answers that k or more learners gave (./shortlistEntries.ts).
 * Spec: INS-003, UD-006, UD-010
 * Invariants:
 *   - Each question is on the list at most once, in the order it was added; a second press takes it off.
 *   - The list stays when the period, version or context changes, so a teacher can collect from several views.
 *   - A11Y: every change is announced with the question and the list's length (WCAG 4.1.3). A length of one has its
 *     own texts («1 question», not «1 questions»): translate.ts has no plurals, as gradeSync's `retriedOne` shows.
 *   - A11Y: an announcement quotes the question's own text as its quoted part, in the activity's language (UD-010);
 *     the name of a question without text, or no longer there, is not marked.
 *   - PRIVACY: nothing is written to storage; the entries come from the already suppressed view (INS-006).
 * Collaborators: ./shortlistEntries.ts, ./quotedText.tsx, ./ShortlistButton.tsx, ./InsightShortlist.tsx,
 *   ./InsightPanel.tsx (`useQuotedAnnouncement`).
 * Tests: apps/web/test/features/insight/InsightShortlist.test.tsx,
 *   apps/web/test/features/insight/InsightQuotedLanguage.test.tsx
 */
'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/translate';
import { t } from '../../i18n/translate';
import type { InsightReport } from './insightReportShape';
import { quotedSentence, type QuotedText } from './quotedText';
import { shortlistEntry, type ShortlistEntry } from './shortlistEntries';

/** The shortlist and what can be done with it. */
export interface Shortlist {
  readonly entries: readonly ShortlistEntry[];
  /** Whether the question with this key is on the list. */
  readonly has: (key: string) => boolean;
  /** Adds the question from the view on screen, or takes it off when it is on the list. */
  readonly toggle: (key: string) => void;
  /** Takes the question off the list. */
  readonly remove: (key: string) => void;
}

const EMPTY: Shortlist = { entries: [], has: () => false, toggle: () => undefined, remove: () => undefined };

/** The shortlist of the Innsikt tab; empty outside one. */
export const ShortlistContext = createContext<Shortlist>(EMPTY);

/**
 * The list's length in words.
 * @param count - The number of questions on the list.
 * @param locale - The page locale.
 * @returns «1 spørsmål», «3 spørsmål»; in English «1 question», «3 questions».
 */
export const shortlistCount = (count: number, locale: Locale): string =>
  count === 1 ? t('insight.shortlist.countOne', locale) : t('insight.shortlist.count', locale, { count });

/**
 * What a change to the list says: the question (its own text as the quoted part) and the list's new length.
 * @param change - The message under `insight.shortlist`.
 * @param entry - The question added or taken off.
 * @param count - The list's new length.
 * @param locale - The page locale.
 * @returns The sentence.
 */
const changeSaid = (
  change: 'added' | 'addedOne' | 'removed' | 'removedOne',
  entry: ShortlistEntry,
  count: number,
  locale: Locale,
): QuotedText =>
  quotedSentence(
    `insight.shortlist.${change}`,
    locale,
    { question: entry.question, count },
    entry.authored ? 'question' : undefined,
  );

/**
 * The shortlist of the tab this component is in.
 * @returns The shortlist.
 */
export const useShortlist = (): Shortlist => useContext(ShortlistContext);

/**
 * Keeps the tab's shortlist.
 * @param report - The view on screen; entries are written from it when added.
 * @param locale - The page locale.
 * @param announce - Says a change in the tab's status region.
 * @returns The shortlist, for `ShortlistContext`.
 */
export function useShortlistState(
  report: InsightReport | undefined,
  locale: Locale,
  announce: (message: QuotedText) => void,
): Shortlist {
  const [entries, setEntries] = useState<readonly ShortlistEntry[]>([]);

  const remove = useCallback(
    (key: string) => {
      const entry = entries.find((candidate) => candidate.key === key);
      if (!entry) return;
      const next = entries.filter((candidate) => candidate.key !== key);
      setEntries(next);
      announce(changeSaid(next.length === 1 ? 'removedOne' : 'removed', entry, next.length, locale));
    },
    [entries, locale, announce],
  );

  const toggle = useCallback(
    (key: string) => {
      if (entries.some((candidate) => candidate.key === key)) return remove(key);
      const entry = report && shortlistEntry(report, key, locale);
      if (!entry) return;
      const next = [...entries, entry];
      setEntries(next);
      announce(changeSaid(next.length === 1 ? 'addedOne' : 'added', entry, next.length, locale));
    },
    [entries, report, locale, announce, remove],
  );

  return useMemo(
    () => ({ entries, has: (key: string) => entries.some((entry) => entry.key === key), toggle, remove }),
    [entries, toggle, remove],
  );
}
