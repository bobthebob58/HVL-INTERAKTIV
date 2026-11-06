/**
 * insightFixtureReport — builds an insight report from the fixture's rows without a database, and reads its cells in
 * a compact form for the hand-calculated assertions.
 *
 * Why: the 30-learner fixture's values (INS-001's acceptance) are checked twice: here on the pure report builder, and
 *      in insightService.int.test.ts through PostgreSQL. Both read the same rows from ../fixtures/thirtyLearners.ts.
 * Spec: INS-001, INS-006
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/videoLearners.test.ts
 */
import type { InsightScope } from '@hvl-interaktiv/api-contract';
import { buildInsightReport } from '../../../src/insight/buildInsightReport.js';
import { toInsightStatements } from '../../../src/insight/data/insightStatements.js';
import type { InsightReport } from '../../../src/insight/insightReport.js';
import { minimumGroupSize, type MinimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { FIXTURE_NOW, PERIOD_START, type FixtureRow } from '../fixtures/thirtyLearners.js';

/** The fixture's *k*. */
export const K5 = minimumGroupSize(5);

/** A cell as the assertions write it: its value, `'<k'` when suppressed, or null when not available. */
export type Shown = number | '<k' | null;

/**
 * Reads a cell compactly.
 * @param cell - A shown or suppressed cell, or null.
 * @param digits - Round a shown value to this many decimals.
 * @returns The value, `'<k'` or null.
 */
export function shown(
  cell: { suppressed: true } | { suppressed: false; value: number } | null,
  digits = 4,
): Shown {
  if (cell === null) return null;
  return cell.suppressed ? '<k' : Number(cell.value.toFixed(digits));
}

/**
 * The scope the fixture's views report.
 * @param k - The minimum group size.
 * @returns A 7-day view of version 1 in the portal (the report builder does not read it).
 */
export const fixtureScope = (k: number): InsightScope => ({
  contentId: '0190f5d2-0000-7000-8000-000000000001',
  contentVersion: 1,
  currentVersion: 1,
  context: { key: 'portal', label: null },
  period: '7d',
  periodStart: PERIOD_START.toISOString(),
  periodEnd: FIXTURE_NOW.toISOString(),
  k,
});

/**
 * Builds a report from fixture rows, ordered by time as the database orders them.
 * @param activity - The activity's main library and parameters.
 * @param rows - Rows inside the view.
 * @param options - *k* (5 by default), the course's NRPS count, and changes to the scope (e.g. an older version).
 * @returns The report.
 */
export function reportOf(
  activity: { readonly mainLibrary: string; readonly params: unknown },
  rows: readonly FixtureRow[],
  options: {
    readonly size?: MinimumGroupSize;
    readonly courseLearners?: number;
    readonly scope?: Partial<InsightScope>;
  } = {},
): InsightReport {
  const size = options.size ?? K5;
  const ordered = [...rows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return buildInsightReport({
    scope: { ...fixtureScope(size.k), ...options.scope },
    size,
    mainLibrary: activity.mainLibrary,
    params: activity.params,
    statements: toInsightStatements(ordered),
    courseLearners: options.courseLearners,
  });
}
