/**
 * insightSummaries — the one-sentence text summary of each insight chart, e.g. «Av spørsmåla der delen riktige kan
 * visast, er spørsmål 2 vanskelegast, «…»: 38 % riktig på første forsøk og 62 % på siste.»
 *
 * Why: INS-008 gives every chart a text summary ("Question 2: 38 % correct on first attempt; most common wrong answer:
 *      B"), so a teacher who does not read charts, or hears the page, gets the point first. The summaries name only
 *      values the server showed: a hidden value is never named (INS-006). A hidden cell can still hold the hardest
 *      item or the most common answer, so each sentence says it chose among the values that can be shown
 *      («av dei som kan visast», D-106's amendment of 2026-11-04) and is never false.
 * Spec: INS-008, INS-002, INS-003, INS-005, INS-006, UD-010
 * Invariants:
 *   - Built only from shown cells, and the text says so; when no value qualifies, the summary says that none can be
 *     shown.
 *   - Items arrive hardest first (the server's order), so the hardest shown item is the first with a shown share.
 *   - PRIVACY: a wrong answer named here is one the server listed, so at least k learners gave it (INS-003).
 *   - A question without text, or no longer in the activity, is named by its place («Spørsmål 3 (utan tekst)»).
 *   - A11Y: a summary that quotes the activity's own text gives its range (./quotedText.tsx), so the section marks
 *     only that part with the activity's language (UD-010); a fallback name is never marked.
 * Collaborators: ./insightFormat.ts, ./insightReportShape.ts, ./quotedText.tsx, the sections in this folder,
 *   ./shortlistEntries.ts.
 * Tests: apps/web/test/features/insight/insightSummaries.test.ts,
 *   apps/web/test/features/insight/InsightQuotedLanguage.test.tsx
 */
import { t, type Locale } from '../../i18n/translate';
import { cellText, formatValue, shownValue, videoTime } from './insightFormat';
import { plainText, quotedSentence, type QuotedText } from './quotedText';
import type {
  BranchingDecisionInsight,
  BranchingOptionInsight,
  ChoiceMisconception,
  GapInsight,
  ItemDifficultyInsight,
  VideoInteractionInsight,
} from './insightReportShape';

/**
 * The name of a question: its text, or, when it has none or is gone, its place, so that no row header, button or
 * sentence is left empty and no two such questions share a name (WCAG 1.3.1, 2.4.6).
 * @param text - The question text; '' when the parameters hold none, null when the question is no longer there.
 * @param number - The question's place in the view's items (1 = hardest), as in the table's «Nr.» column.
 * @param locale - The page locale.
 * @returns The name.
 */
export function questionLabel(text: string | null, number: number, locale: Locale): string {
  if (text === null) return t('insight.items.gone', locale, { number });
  return text === '' ? t('insight.items.untitled', locale, { number }) : text;
}

/**
 * INS-002: the hardest item with a shown first-attempt share.
 * @param items - Hardest first.
 * @param k - The minimum group size.
 * @param locale - The page locale.
 * @returns The summary; the question's own text is its quoted part, the name of one without text is not.
 */
export function itemsSummary(items: readonly ItemDifficultyInsight[], k: number, locale: Locale): QuotedText {
  const index = items.findIndex((item) => shownValue(item.firstCorrect) !== undefined);
  const item = items[index];
  if (!item) return plainText(t('insight.items.summaryNone', locale));
  const params = {
    number: index + 1,
    question: questionLabel(item.questionText, index + 1, locale),
    first: cellText(item.firstCorrect, 'percent', k, locale),
    latest: cellText(item.latestCorrect, 'percent', k, locale),
  };
  return quotedSentence('insight.items.summary', locale, params, item.questionText ? 'question' : undefined);
}

/**
 * INS-003: the most chosen wrong option of a choice question, among the shown counts.
 * @param question - The question's distribution.
 * @returns The option and its count, or undefined when no wrong option has a shown count above 0.
 */
export function commonestWrongOption(
  question: ChoiceMisconception,
): { readonly text: string; readonly count: number; readonly feedback: string | null } | undefined {
  let best: { text: string; count: number; feedback: string | null } | undefined;
  for (const option of question.options) {
    const count = shownValue(option.learners);
    if (option.correct || count === undefined || count === 0) continue;
    if (!best || count > best.count) best = { text: option.text, count, feedback: option.feedback };
  }
  return best;
}

/**
 * INS-003: the summary of a choice question.
 * @param question - The question's distribution.
 * @param locale - The page locale.
 * @returns The commonest wrong option (its quoted part), that no learner chose a wrong one, or that none can be shown.
 */
export function choiceSummary(question: ChoiceMisconception, locale: Locale): QuotedText {
  const wrong = commonestWrongOption(question);
  if (wrong) {
    const count = formatValue(wrong.count, 'count', locale);
    return quotedSentence('insight.choice.summary', locale, { option: wrong.text, count }, 'option');
  }
  const allShownZero = question.options.every(
    (option) => option.correct || shownValue(option.learners) === 0,
  );
  return plainText(t(allShownZero ? 'insight.choice.summaryNoWrong' : 'insight.choice.summaryNone', locale));
}

/**
 * INS-003: the summary of one gap.
 * @param gap - The gap's first answers.
 * @param locale - The page locale.
 * @returns The commonest listed wrong answer (its quoted part, typed in the activity), or that none can be shown.
 */
export function gapSummary(gap: GapInsight, locale: Locale): QuotedText {
  const number = gap.index + 1;
  const wrong = gap.wrongAnswers.find((answer) => (shownValue(answer.learners) ?? 0) > 0);
  const count = wrong ? shownValue(wrong.learners) : undefined;
  if (!wrong || count === undefined) return plainText(t('insight.gaps.summaryNone', locale, { number }));
  const params = { number, answer: wrong.answer, count: formatValue(count, 'count', locale) };
  return quotedSentence('insight.gaps.summary', locale, params, 'answer');
}

/**
 * The name of a video interaction: its label, else its question, else «Oppgåve utan tittel».
 * @param interaction - The interaction.
 * @param locale - The page locale.
 * @returns The name.
 */
export const interactionName = (interaction: VideoInteractionInsight, locale: Locale): string =>
  interaction.label ?? interaction.questionText ?? t('insight.video.untitled', locale);

/**
 * INS-005: the interaction the smallest shown share answered.
 * @param interactions - In the video's order.
 * @param locale - The page locale.
 * @returns The summary; the task's label or question is its quoted part, «Oppgåve utan tittel» is not.
 */
export function videoSummary(interactions: readonly VideoInteractionInsight[], locale: Locale): QuotedText {
  let lowest: VideoInteractionInsight | undefined;
  for (const interaction of interactions) {
    const share = shownValue(interaction.share);
    if (share === undefined) continue;
    if (!lowest || share < (shownValue(lowest.share) ?? Infinity)) lowest = interaction;
  }
  if (!lowest) return plainText(t('insight.video.summaryNone', locale));
  const params = {
    task: interactionName(lowest, locale),
    time: videoTime(lowest.atSeconds, locale),
    share: formatValue(shownValue(lowest.share) ?? 0, 'percent', locale),
  };
  const named = (lowest.label ?? lowest.questionText) !== null;
  return quotedSentence('insight.video.summary', locale, params, named ? 'task' : undefined);
}

/**
 * The name of a decision: its question, or its place in the scenario when it has no text.
 * @param text - The decision's question; '' when the parameters hold none.
 * @param number - The decision's place among the scenario's decisions, from 1.
 * @param locale - The page locale.
 * @returns The name.
 */
export const decisionLabel = (text: string, number: number, locale: Locale): string =>
  text === '' ? t('insight.branching.untitled', locale, { number }) : text;

/**
 * The name of a decision's option: its text, or its place when it has none.
 * @param option - The option.
 * @param locale - The page locale.
 * @returns The name.
 */
export const optionLabel = (option: BranchingOptionInsight, locale: Locale): string =>
  option.text === ''
    ? t('insight.branching.untitledOption', locale, { number: option.index + 1 })
    : option.text;

/**
 * INS-004: the option most learners chose first at a decision, among the shown counts.
 * @param decision - The decision.
 * @param locale - The page locale.
 * @returns The summary; the option's own text is its quoted part, the name of one without text is not. Options
 *   with the same highest count are named as a tie, never one of them as the most chosen.
 */
export function decisionSummary(decision: BranchingDecisionInsight, locale: Locale): QuotedText {
  const counts = decision.options.map((option) => shownValue(option.learners) ?? 0);
  const highest = Math.max(0, ...counts);
  if (highest === 0) return plainText(t('insight.branching.summaryNone', locale));
  const count = formatValue(highest, 'count', locale);
  const leaders = decision.options.filter((_, index) => counts[index] === highest);
  const [best] = leaders;
  if (!best || leaders.length > 1) return plainText(t('insight.branching.summaryTie', locale, { count }));
  const params = { option: optionLabel(best, locale), count };
  return quotedSentence('insight.branching.summary', locale, params, best.text ? 'option' : undefined);
}
