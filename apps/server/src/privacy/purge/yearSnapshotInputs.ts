/**
 * yearSnapshotInputs — reads what the yearly purge's snapshots are computed from: the ended years and activities that
 * have stored statements, and, for one activity and one stored year, each learner's places per semester and their root
 * results, in the shapes the pedagogisk mappe's group rules take.
 *
 * Why: D-107 writes the ended year's `InsightSnapshot` rows before anything is deleted, with the values the mappe
 *      shows, under the mappe's rules (D-095 and its amendment of 2026-11-04). The mappe's own source reads every year
 *      of chosen activities; the purge reads exactly the rows it is about to delete (by their stored year), one
 *      activity at a time, so a large year is never held in memory at once.
 * Spec: DATA-003, MAPPE-003
 * Invariants:
 *   - Rows are selected by their stored `academicYear`, as the deletion selects them (./purgeTables.ts), except that
 *     rows of Canvas's test student (`testUser`) are never read, as the mappe never reads them (D-102's amendment of
 *     2026-11-04); the deletion still takes them.
 *   - The presences and results mean what the mappe's do (../../learningDesign/mappe/storedActivityResults.ts): a
 *     learner is present in a place (context, version) and semester with any stored statement; results are the root
 *     `answered` and `completed` rows in stored order (timestamp, then ID).
 *   - PRIVACY: the learner key leaves this module only inside these inputs, which ./yearSnapshots.ts reduces to
 *     aggregates; nothing is logged or written here.
 * Collaborators: ./yearSnapshots.ts (the caller), ../../learningDesign/mappe/learnerSummaries.ts (the shapes),
 *   ../../learningDesign/mappe/resultSemesters.ts (the semesters), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { LearnerPresence, LearnerRootResult } from '../../learningDesign/mappe/learnerSummaries.js';
import { semesterWindows } from '../../learningDesign/mappe/resultSemesters.js';

/** The verbs of a stored root result (`isStoredRootResult` in ../../xapi/xapiRootTests.ts), for the query. */
const ROOT_RESULT_VERBS = ['answered', 'completed'];
/** PRIVACY: Canvas's test students are in no snapshot, as in no group of the mappe (D-102's amendment of 2026-11-04). */
const NOT_TEST_USER = { testUser: false } as const;

/** What one activity's snapshots for one year are computed from. */
export interface YearActivityRows {
  /** One entry per learner, place and semester. */
  readonly presences: readonly LearnerPresence[];
  /** The root results in stored order. */
  readonly results: readonly LearnerRootResult[];
}

/** An activity with stored statements in an ended year. */
export interface YearActivity {
  readonly year: number;
  readonly contentId: string;
}

/** The statement tables this module reads. */
type StatementReader = Pick<Database, 'xapiStatement'>;

/**
 * The activities that have stored statements in the years before the current one.
 * @param db - The database.
 * @param currentYear - The current academic year; its rows are never read.
 * @returns One entry per stored year and activity, by year, then activity.
 * @spec DATA-003
 */
export async function yearActivities(db: StatementReader, currentYear: number): Promise<YearActivity[]> {
  const rows = await db.xapiStatement.groupBy({
    by: ['academicYear', 'contentId'],
    where: { academicYear: { lt: currentYear }, ...NOT_TEST_USER },
    orderBy: [{ academicYear: 'asc' }, { contentId: 'asc' }],
  });
  return rows.map((row) => ({ year: row.academicYear, contentId: row.contentId }));
}

/**
 * The places (activity, context, version) per stored year that the years before the current one hold.
 * @param db - The database.
 * @param currentYear - The current academic year.
 * @returns One entry per stored year and place: each becomes one snapshot.
 * @spec DATA-003
 */
export async function yearPlaces(
  db: StatementReader,
  currentYear: number,
): Promise<{ readonly year: number }[]> {
  const rows = await db.xapiStatement.groupBy({
    by: ['academicYear', 'contentId', 'contextId', 'contentVersion'],
    where: { academicYear: { lt: currentYear }, ...NOT_TEST_USER },
  });
  return rows.map((row) => ({ year: row.academicYear }));
}

/**
 * Reads one activity's presences and root results of one stored year.
 * @param db - The database.
 * @param contentId - The activity.
 * @param year - The stored academic year.
 * @returns The inputs; empty when the activity has no row of that year.
 * @spec DATA-003
 */
export async function readYearActivityRows(
  db: StatementReader,
  contentId: string,
  year: number,
): Promise<YearActivityRows> {
  const where = { contentId, academicYear: year, ...NOT_TEST_USER };
  const span = await db.xapiStatement.aggregate({
    where,
    _min: { timestamp: true },
    _max: { timestamp: true },
  });
  const { timestamp: first } = span._min;
  const { timestamp: last } = span._max;
  if (!first || !last) return { presences: [], results: [] };
  const [presences, results] = await Promise.all([
    Promise.all(
      semesterWindows(first, last).map(async (window) => {
        const rows = await db.xapiStatement.groupBy({
          by: ['contextId', 'contentVersion', 'learnerKey'],
          where: { ...where, timestamp: { gte: window.start, lt: window.end } },
        });
        return rows.map((row) => ({
          contentId,
          contextId: row.contextId,
          contentVersion: row.contentVersion,
          learner: row.learnerKey,
          semesterStart: window.start,
        }));
      }),
    ),
    db.xapiStatement.findMany({
      where: { ...where, subContentId: null, verb: { in: ROOT_RESULT_VERBS } },
      select: {
        contextId: true,
        contentVersion: true,
        learnerKey: true,
        subContentId: true,
        verb: true,
        scoreMax: true,
        scaled: true,
        timestamp: true,
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    }),
  ]);
  return {
    presences: presences.flat(),
    // PRIVACY: the key only tells learners apart in the mappe's summaries, which keep no identifier (D-095).
    results: results.map(({ learnerKey, ...result }) => ({ ...result, contentId, learner: learnerKey })),
  };
}
