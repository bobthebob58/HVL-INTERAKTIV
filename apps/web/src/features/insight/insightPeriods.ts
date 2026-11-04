/**
 * insightPeriods — the fixed periods the Innsikt tab offers, in order, and their names: the last 7, 14 or 30 days, or
 * since the semester started.
 *
 * Why: spec 05 §1 reads "results since a chosen date"; insight offers fixed periods only, each from midnight Oslo
 *      time, so two overlapping views cannot isolate one learner (differencing, D-106). The last 7 days is the
 *      default («Før samlinga»). The list mirrors the contract's `INSIGHT_PERIODS` as values here, so only types come
 *      from the contract and zod stays out of the browser bundle; a test keeps the two equal.
 * Spec: INS-006, INS-007, PROD-010
 * Invariants:
 *   - SPEC-DEVIATION: D-106 — the period is one of four fixed values, never a free date, anywhere in the tab.
 *   - Exactly the contract's periods, in its order; `7d` first, the default (`DEFAULT_INSIGHT_PERIOD`).
 * Collaborators: @hvl-interaktiv/api-contract (`InsightPeriod`), ./InsightQueryForm.tsx, ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/insightLabels.test.ts
 */
import type { InsightPeriod } from '@hvl-interaktiv/api-contract';
import { t, type Locale, type MessageKey } from '../../i18n/translate';

/** The periods in the order offered (the contract's `INSIGHT_PERIODS`). */
export const PERIODS: readonly InsightPeriod[] = ['7d', '14d', '30d', 'semester'];

/** The period shown first (the contract's `DEFAULT_INSIGHT_PERIOD`). */
export const DEFAULT_PERIOD: InsightPeriod = '7d';

const PERIOD_NAME: Readonly<Record<InsightPeriod, MessageKey>> = {
  '7d': 'insight.query.period7d',
  '14d': 'insight.query.period14d',
  '30d': 'insight.query.period30d',
  semester: 'insight.query.periodSemester',
};

/**
 * The name of a period.
 * @param period - The period.
 * @param locale - The page locale.
 * @returns For example «Siste 7 dagar» or «Sidan semesterstart».
 */
export const periodName = (period: InsightPeriod, locale: Locale): string => t(PERIOD_NAME[period], locale);
