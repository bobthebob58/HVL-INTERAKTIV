/**
 * insightScopeText — what one insight view covers, in words: its context, its period with the day it starts and its
 * content version, as the scope line above the view and as the source line of a «Ta opp i samlinga» entry.
 *
 * Why: D-106 shows one context, one version (PROD-013) and one fixed period at a time, and the numbers mean nothing
 *      without them. The shortlist keeps entries from several views (INS-003), so each entry names the view its
 *      numbers came from, in the same words as the scope line, so a printout never mixes courses or periods unseen.
 * Spec: INS-007, PROD-013, INS-003
 * Invariants:
 *   - Built from the answer's own scope, never from the form, so the words describe the numbers shown.
 *   - The context is written as it reads mid-sentence («Viser portalen (spelt utanom Canvas), …»).
 *   - PRIVACY: the scope names a context, a period and a version only; nothing about a learner.
 * Collaborators: ./insightContextLabels.ts, ./insightPeriods.ts, ../../i18n/formatDate.ts, ./InsightReportView.tsx,
 *   ./InsightPanel.tsx, ./shortlistEntries.ts.
 * Tests: apps/web/test/features/insight/InsightQuery.test.tsx, apps/web/test/features/insight/InsightShortlist.test.tsx
 */
import type { InsightScope } from '@hvl-interaktiv/api-contract';
import { formatDate } from '../../i18n/formatDate';
import { t, type Locale } from '../../i18n/translate';
import { contextNameInText } from './insightContextLabels';
import { periodName } from './insightPeriods';
import type { InsightReport } from './insightReportShape';

/** The parts of a scope as they are written into a sentence. */
export interface ScopeWords {
  readonly context: string;
  readonly period: string;
  readonly start: string;
  readonly version: number;
}

/**
 * The parts of a view's scope in words.
 * @param scope - The view's scope.
 * @param locale - The page locale.
 * @returns For example `{ context: 'SYK110 i Canvas', period: 'siste 7 dagar', start: '28. okt. 2026', version: 3 }`;
 *   the portal is `portalen (spelt utanom Canvas)`.
 */
export const scopeWords = (scope: InsightScope, locale: Locale): ScopeWords => ({
  // WHY: the words go into running sentences, so the portal is «portalen», not the selector's «Portalen».
  context: contextNameInText(scope.context, locale),
  period: periodName(scope.period, locale).toLowerCase(),
  start: formatDate(scope.periodStart, locale),
  version: scope.contentVersion,
});

/**
 * The sentence that says what a view covers.
 * @param report - The view.
 * @param locale - The page locale.
 * @returns For example «Viser SYK110 i Canvas, siste 7 dagar (frå 28. okt. 2026), versjon 3.»
 */
export const scopeSentence = (report: InsightReport, locale: Locale): string =>
  t('insight.scope', locale, { ...scopeWords(report.scope, locale) });
