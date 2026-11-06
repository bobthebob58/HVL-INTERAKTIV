/**
 * gradeSyncTexts — the words of the grade-sync panel that depend on the data: a placement's heading, its score rule,
 * and what a retry did.
 *
 * Why: the panel names each placement by course and Canvas (D-103: the same course ID in two of HVL's Canvas
 *      instances is two courses), says which attempt is sent (LTI-012's policies) and reports a retry in words
 *      (WCAG 4.1.3). Kept pure, so every case is tested without rendering.
 * Spec: LTI-012, UD-006
 * Invariants:
 *   - Every text comes from the locale files (DOC-009); numbers are filled in, never concatenated into words.
 *   - Headings are unique within the panel: a second link to the activity in the same course gets its number
 *     (WCAG 2.4.6, 1.3.1), so each section's name tells it apart.
 *   - The mastery threshold is shown as a whole percentage, as authors set it (0.8 → 80 %).
 * Collaborators: ./GradeSyncPanel.tsx, ./GradeSyncPlacementSection.tsx, ../../i18n/translate.ts.
 * Tests: apps/web/test/features/gradeSync/gradeSyncTexts.test.ts
 */
import type { GradeSyncPlacement, GradeSyncRetryResponse } from '@hvl-interaktiv/api-contract';
import { t, type Locale } from '../../i18n/translate';

/**
 * The heading of one placement: its course and Canvas, numbered when another placement has the same pair.
 * @param placement - The placement.
 * @param all - Every placement in the panel, in order.
 * @param locale - The page's language.
 * @returns e.g. «SYK110 i HVL Canvas», or «SYK110 i HVL Canvas (lenkje 2)».
 */
export function placementHeading(
  placement: GradeSyncPlacement,
  all: readonly GradeSyncPlacement[],
  locale: Locale,
): string {
  const course = placement.contextLabel ?? t('gradeSync.courseUnknown', locale);
  const params = { course, platform: placement.platformName };
  const same = all.filter(
    (other) => other.platformName === placement.platformName && other.contextLabel === placement.contextLabel,
  );
  if (same.length < 2) return t('gradeSync.placementHeading', locale, params);
  const number = same.findIndex((other) => other.placementId === placement.placementId) + 1;
  return t('gradeSync.placementHeadingNumbered', locale, { ...params, number });
}

/**
 * Which score a placement sends, in words.
 * @param placement - The placement, with its policy and (for mastery) threshold.
 * @param locale - The page's language.
 * @returns e.g. «Det beste forsøket blir sendt.»
 */
export function policyText(placement: GradeSyncPlacement, locale: Locale): string {
  switch (placement.attemptPolicy) {
    case 'latest':
      return t('gradeSync.policyLatest', locale);
    case 'mastery':
      return t('gradeSync.policyMastery', locale, {
        threshold: Math.round((placement.masteryThreshold ?? 0) * 100),
      });
    default:
      return t('gradeSync.policyBest', locale);
  }
}

/**
 * What a retry did, in words: how many scores wait to be sent again, and how many cannot be.
 * @param result - The server's answer.
 * @param locale - The page's language.
 * @returns One or two sentences.
 */
export function retryMessage(result: GradeSyncRetryResponse, locale: Locale): string {
  const { requeued, stillFailed } = result;
  const parts: string[] = [];
  if (requeued === 1) parts.push(t('gradeSync.retriedOne', locale));
  else if (requeued > 1) parts.push(t('gradeSync.retriedOther', locale, { count: requeued }));
  else if (stillFailed === 0) parts.push(t('gradeSync.retriedNone', locale));
  if (stillFailed === 1) parts.push(t('gradeSync.stillFailedOne', locale));
  else if (stillFailed > 1) parts.push(t('gradeSync.stillFailedOther', locale, { count: stillFailed }));
  return parts.join(' ');
}
