/**
 * statementsToYesterday — moves an activity's stored xAPI rows one day back in time, so a test that plays through the
 * real ingestion route today can read them in an insight view, which holds the data up to and including yesterday.
 *
 * Why: D-106's amendment of 2026-11-04 ends every insight period at the latest midnight in Oslo, so a statement
 *      stored today is in no view until tomorrow. The end-to-end and route tests store their learners' statements now,
 *      through the real bridge or route; moving them back is the one change to stored data they need, and keeps the
 *      server's clock real.
 * Spec: INS-001, INS-006
 * Invariants:
 *   - Moves the `timestamp` of the chosen rows back by exactly 24 hours and sets `academicYear` to the academic year
 *     of the new time (`academicYearOf`), so a test run on 1 August still finds its rows in the view (which then
 *     belongs to the year that ended).
 *   - Touches the given activity's rows only (of the given learners, when named), and only in the test database;
 *     naming the learners lets a test move each learner once.
 * Collaborators: ../../src/insight/scope/insightPeriod.ts (the period it fits), ../../e2e/insightInCanvas.e2e.test.ts,
 *   ../xapi/xapiTestUser.int.test.ts.
 * Tests: apps/server/e2e/insightInCanvas.e2e.test.ts, apps/server/test/xapi/xapiTestUser.int.test.ts
 */
import type { Database } from '../../src/infra/prismaClient.js';
import { academicYearOf } from '../../src/privacy/academicYear.js';

const DAY_MS = 86_400_000;

/**
 * Moves an activity's stored statements one day back.
 * @param db - The test database.
 * @param contentId - The activity.
 * @param learnerKeys - Only these learners' rows; every row of the activity when omitted.
 * @returns How many rows moved.
 */
export async function moveStatementsToYesterday(
  db: Database,
  contentId: string,
  learnerKeys?: readonly string[],
): Promise<number> {
  const rows = await db.xapiStatement.findMany({
    where: { contentId, ...(learnerKeys ? { learnerKey: { in: [...learnerKeys] } } : {}) },
    select: { id: true, timestamp: true },
  });
  for (const row of rows) {
    const timestamp = new Date(row.timestamp.getTime() - DAY_MS);
    await db.xapiStatement.update({
      where: { id: row.id },
      data: { timestamp, academicYear: academicYearOf(timestamp) },
    });
  }
  return rows.length;
}
