/**
 * shortlistContext — the «Ta opp i samlinga» list of the Innsikt tab: which questions are on it, and adding or taking
 * one off from any section of the tab, each change said in the tab's status region.
 *
 * Why: INS-003 puts a «Ta opp i samlinga» button by each question, in the item table and by each misconception, and
 *      one shortlist below them collects what was added, for printing or projecting. A context shares the list between
 *      the buttons and the list without passing it through every section. The list lives in the page's memory only,
 *      and holds words, not data about a learner.
 * Spec: INS-003, UD-006
 * Invariants:
 *   - Each question is on the list at most once, in the order it was added; a second press takes it off.
 *   - The list stays when the period, version or context changes, so a teacher can collect from several views.
 *   - A11Y: every change is announced with the question and the list's length (WCAG 4.1.3). A length of one has its
 *     own texts («1 question», not «1 questions»): translate.ts has no plurals, as gradeSync's `retriedOne` shows.
 *   - PRIVACY: nothing is written to storage; the entries come from the already suppressed view (INS-006).
 * Collaborators: ./shortlistEntries.ts, ./ShortlistButton.tsx, ./InsightShortlist.tsx, ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/InsightShortlist.test.tsx
 */
'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/translate';
import { t } from '../../i18n/translate';
import type { InsightReport } from './insightReportShape';
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
  announce: (message: string) => void,
): Shortlist {
  const [entries, setEntries] = useState<readonly ShortlistEntry[]>([]);

  const remove = useCallback(
    (key: string) => {
      const entry = entries.find((candidate) => candidate.key === key);
      if (!entry) return;
      const next = entries.filter((candidate) => candidate.key !== key);
      setEntries(next);
      announce(
        next.length === 1
          ? t('insight.shortlist.removedOne', locale, { question: entry.question })
          : t('insight.shortlist.removed', locale, { question: entry.question, count: next.length }),
      );
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
      announce(
        next.length === 1
          ? t('insight.shortlist.addedOne', locale, { question: entry.question })
          : t('insight.shortlist.added', locale, { question: entry.question, count: next.length }),
      );
    },
    [entries, report, locale, announce, remove],
  );

  return useMemo(
    () => ({ entries, has: (key: string) => entries.some((entry) => entry.key === key), toggle, remove }),
    [entries, toggle, remove],
  );
}
