/**
 * insightPeriods — the fixed periods the Innsikt tab offers, in order, and their names: the last 7, 14 or 30 days, or
 * since the semester started; and what a view's period says about itself: its last day, and whether it was shortened.
 *
 * Why: spec 05 §1 reads "results since a chosen date"; insight offers fixed periods only, each from midnight Oslo
 *      time, so two overlapping views cannot isolate one learner (differencing, D-106). The last 7 days is the
 *      default («Før samlinga»). The list mirrors the contract's `INSIGHT_PERIODS` as values here, so only types come
 *      from the contract and zod stays out of the browser bundle; a test keeps the two equal. D-106's amendment of
 *      2026-11-04 ends every period at the latest midnight in Oslo and starts none before 1 August of its academic
 *      year, and the tab says both (./InsightNotes.tsx), from the view's own start and end.
 * Spec: INS-006, INS-007, PROD-010
 * Invariants:
 *   - SPEC-DEVIATION: D-106 — the period is one of four fixed values, never a free date, anywhere in the tab.
 *   - Exactly the contract's periods, in its order; `7d` first, the default (`DEFAULT_INSIGHT_PERIOD`).
 *   - A view's last day is the Oslo day before its end; a 7-, 14- or 30-day view is shortened when it holds fewer
 *     Oslo calendar days than its name (the server moved its start to 1 August); a semester never is.
 * Collaborators: @hvl-interaktiv/api-contract (`InsightPeriod`, `InsightScope`), ../../i18n/formatDate.ts
 *   (`HVL_TIME_ZONE`), ./InsightQueryForm.tsx, ./InsightPanel.tsx, ./InsightNotes.tsx.
 * Tests: apps/web/test/features/insight/insightLabels.test.ts, apps/web/test/features/insight/InsightPeriodNote.test.tsx
 */
import type { InsightPeriod, InsightScope } from '@hvl-interaktiv/api-contract';
import { HVL_TIME_ZONE } from '../../i18n/formatDate';
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

const DAYS: Readonly<Record<Exclude<InsightPeriod, 'semester'>, number>> = { '7d': 7, '14d': 14, '30d': 30 };

const osloCalendarDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: HVL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Oslo calendar day of an ISO moment, as a number of days since 1 January 1970. */
const osloDayNumber = (iso: string): number => {
  const [year = 0, month = 1, day = 1] = osloCalendarDate.format(new Date(iso)).split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

/**
 * The last moment a view holds: its end, the latest midnight in Oslo, less a millisecond, so the date is yesterday's.
 * @param periodEnd - The view's `periodEnd`.
 * @returns An ISO moment on the view's last day, for `formatDate`.
 */
export const lastDayOf = (periodEnd: string): string => new Date(Date.parse(periodEnd) - 1).toISOString();

/**
 * Whether a view's period was shortened so that it starts on 1 August (D-106's amendment of 2026-11-04).
 * @param scope - The view's period, start and end.
 * @returns True for a 7-, 14- or 30-day view that holds fewer Oslo calendar days than its name.
 */
export const isShortenedPeriod = (
  scope: Pick<InsightScope, 'period' | 'periodStart' | 'periodEnd'>,
): boolean =>
  scope.period !== 'semester' &&
  osloDayNumber(scope.periodEnd) - osloDayNumber(scope.periodStart) < DAYS[scope.period];
