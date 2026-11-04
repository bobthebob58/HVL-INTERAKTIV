/**
 * shortlistEntries — what the «Ta opp i samlinga» list says about one question: its text, the view its numbers come
 * from, and a few lines of shown aggregates (the share correct, the commonest wrong answer with the teacher's
 * feedback, the commonest wrong answer per gap), written when the question is added.
 *
 * Why: INS-003's «Ta opp i samlinga» adds an item to a shortlist that can be printed or projected in the seminar. The
 *      entry is a snapshot in words, so it stays the same when the teacher changes the period or version, and it can
 *      only say what the tab showed: aggregates and the teacher's own texts, no personal data (INS-006). As the list
 *      keeps entries from several views, each names its own (context, period, version), so a printout never presents
 *      numbers from two courses or periods as one.
 * Spec: INS-003, INS-002, INS-006
 * Invariants:
 *   - PRIVACY: built only from the already suppressed report; a hidden value stays «< k» or is left out.
 *   - An item is keyed by its `subContentId`, or by `ACTIVITY_ITEM` for the activity itself (a single question).
 *   - PEDAGOGY: Just-in-Time Teaching (spec 05): each entry names the difficulty and the misconception to discuss.
 * Collaborators: ./insightReportShape.ts, ./insightFormat.ts, ./insightSummaries.ts, ./insightScopeText.ts,
 *   ./shortlistContext.tsx.
 * Tests: apps/web/test/features/insight/InsightShortlist.test.tsx
 */
import { t, type Locale } from '../../i18n/translate';
import { cellText } from './insightFormat';
import type { InsightReport } from './insightReportShape';
import { scopeWords } from './insightScopeText';
import { choiceSummary, commonestWrongOption, gapSummary, questionLabel } from './insightSummaries';

/** The key of the activity itself when it is a single question (`item: null`). */
export const ACTIVITY_ITEM = ':activity';

/** One question on the shortlist. */
export interface ShortlistEntry {
  /** The item's key (`subContentId` or `ACTIVITY_ITEM`). */
  readonly key: string;
  /** The question's text. */
  readonly question: string;
  /** The view the numbers come from, e.g. «Tal frå SYK110 i Canvas, siste 7 dagar (frå 28. okt. 2026), versjon 3.» */
  readonly view: string;
  /** Shown aggregates and the teacher's feedback, one sentence each. */
  readonly lines: readonly string[];
}

/**
 * The key of an item.
 * @param item - A `subContentId`, or null for the activity itself.
 * @returns The key.
 */
export const itemKey = (item: string | null): string => item ?? ACTIVITY_ITEM;

/**
 * Writes the shortlist entry of one question from the view on screen.
 * @param report - The view.
 * @param key - The item's key.
 * @param locale - The page locale.
 * @returns The entry, or undefined when the view has no such question.
 * @spec INS-003
 */
export function shortlistEntry(
  report: InsightReport,
  key: string,
  locale: Locale,
): ShortlistEntry | undefined {
  const { k } = report.scope;
  const item = report.items.find((candidate) => itemKey(candidate.item) === key);
  const misconception = report.misconceptions.find((candidate) => itemKey(candidate.item) === key);
  if (!item && !misconception) return undefined;
  const lines: string[] = [];
  if (item?.firstCorrect) {
    lines.push(
      t('insight.shortlist.lineItem', locale, {
        first: cellText(item.firstCorrect, 'percent', k, locale),
        latest: cellText(item.latestCorrect, 'percent', k, locale),
        learners: cellText(item.learners, 'count', k, locale),
      }),
    );
  }
  if (misconception?.kind === 'choice') {
    lines.push(choiceSummary(misconception, locale));
    const feedback = commonestWrongOption(misconception)?.feedback;
    if (feedback) lines.push(t('insight.shortlist.lineFeedback', locale, { feedback }));
  }
  if (misconception?.kind === 'gaps') {
    for (const gap of misconception.gaps) lines.push(gapSummary(gap, locale));
  }
  return {
    key,
    question: misconception?.questionText ?? questionLabel(item?.questionText ?? null, locale),
    view: t('insight.shortlist.lineView', locale, { ...scopeWords(report.scope, locale) }),
    lines,
  };
}
