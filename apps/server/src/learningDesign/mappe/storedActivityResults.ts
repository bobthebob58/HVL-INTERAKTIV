/**
 * storedActivityResults — the pedagogisk mappe's real results source (D-095): reads the stored xAPI statements of the
 * chosen activities and hands ./activityResults.ts one summary per learner and group, from groups of at least *k*
 * learners.
 *
 * Why: S5 stored no results, so its source answered "no results yet"; S6 stores learners' statements (D-102, D-115),
 *      and MAPPE-002 shows per activity the participants, the completion rate, the median attempts and the change
 *      from the first to the last attempt. Insight's report (../../insight/InsightService.ts) does not fit: it covers
 *      one course, one version and one period, already suppressed, so its cells cannot be added up across courses,
 *      and it has no change between attempts. This reads the same rows by the same rules (D-115) instead, counts each
 *      group as insight sees it, and leaves out every group insight would suppress (./learnerSummaries.ts).
 * Spec: MAPPE-003, MAPPE-002
 * Invariants:
 *   - PRIVACY: reads only `XapiStatement` rows of the activities it is given (the renderer passes only the author's
 *     own and co-authored ones, D-066), and only the columns the summaries need; `learnerKey` goes no further than
 *     ./learnerSummaries.ts, and nothing is logged.
 *   - Reads only: it writes no row, no object and no log line, so the export stays unstored (MAPPE-003).
 *   - Building it contacts nothing. A call reads the span of the activities' statements, then, together, the
 *     learners of each semester in that span (one grouped query each) and the root results in stored order.
 *   - No period: every statement stored until the yearly purge counts (D-107); every stored statement counts towards
 *     "started", as in insight (D-115).
 *   - PRIVACY: only rows stored before the latest midnight in Oslo at the moment of the call are read, as insight's
 *     views end there (D-106's amendment of 2026-11-05), so two exports on one day are the same and an export minus
 *     insight's `semester` view never gives today's learners.
 *   - PRIVACY: rows of Canvas's test student (`testUser`) are never read, so no group, *k* count or summary holds one
 *     (D-102's amendment of 2026-11-04); every query here filters by `NOT_TEST_USER`.
 *   - PRIVACY: a semester's learners are read from the rows of its own academic year (`academicYear`, the year of the
 *     key) only, so the portal's 12-hour tail of last year's keys on 1 August (D-057) never makes one learner two in
 *     an autumn group (D-106's amendment of 2026-11-04); a result counts only for a learner present in its group.
 * Collaborators: ../../server/studioServices.ts (builds it), ./MappeRenderer.ts (the caller), ./learnerSummaries.ts,
 *   ./resultSemesters.ts, ../../privacy/academicYear.ts, ../../insight/scope/insightPeriod.ts (`osloMidnight`),
 *   ../../infra/prismaClient.ts.
 * Tests: apps/server/test/learningDesign/mappe/storedActivityResults.int.test.ts,
 *   apps/server/test/learningDesign/mappe/storedResultsBeforeToday.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import { osloDateOf, osloMidnight } from '../../insight/scope/insightPeriod.js';
import { academicYearOf } from '../../privacy/academicYear.js';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import type { ActivityResultsSource, LearnerAttemptSummary } from './activityResults.js';
import { learnerSummaries, type LearnerPresence } from './learnerSummaries.js';
import { semesterWindows, type SemesterWindow } from './resultSemesters.js';

/** The verbs of a stored root result (`isStoredRootResult` in ../../xapi/xapiRootTests.ts), for the query. */
const ROOT_RESULT_VERBS = ['answered', 'completed'];
/** PRIVACY: Canvas's test students are in no group of the mappe (D-102's amendment of 2026-11-04). */
const NOT_TEST_USER = { testUser: false } as const;

/**
 * The learners of each place in one semester, before `until`, under its own year's keys, one row per learner and place.
 */
async function presencesIn(
  db: Database,
  contentIds: string[],
  window: SemesterWindow,
  until: Date,
): Promise<LearnerPresence[]> {
  const rows = await db.xapiStatement.groupBy({
    by: ['contentId', 'contextId', 'contentVersion', 'learnerKey'],
    where: {
      contentId: { in: contentIds },
      timestamp: { gte: window.start, lt: window.end < until ? window.end : until },
      // PRIVACY: one key per learner in a semester: its own year's keys, as insight's views read them (D-106).
      academicYear: academicYearOf(window.start),
      ...NOT_TEST_USER,
    },
  });
  return rows.map((row) => ({
    contentId: row.contentId,
    contextId: row.contextId,
    contentVersion: row.contentVersion,
    learner: row.learnerKey,
    semesterStart: window.start,
  }));
}

/** The pedagogisk mappe's results from the stored learning data. */
export class StoredActivityResults implements ActivityResultsSource {
  /**
   * @param db - The database; only read.
   * @param now - The clock; the reads end at the latest midnight in Oslo before it. Tests pass a fixed one.
   */
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The learners' summaries per activity, one per learner and group, from the groups of at least *k* learners.
   * @param contentIds - The activities, as stored; the caller has checked the author may see each (D-066).
   * @param size - The minimum group size of the export.
   * @returns A map from activity to its summaries; an activity with no group of *k* is missing.
   * @spec MAPPE-003
   */
  async learnerSummaries(
    contentIds: readonly string[],
    size: MinimumGroupSize,
  ): Promise<ReadonlyMap<string, readonly LearnerAttemptSummary[]>> {
    const ids = [...contentIds];
    if (ids.length === 0) return new Map();
    // PRIVACY: nothing of today, as insight's views (D-106's amendment of 2026-11-05): no same-day differencing.
    const until = osloMidnight(osloDateOf(this.now()));
    const before = { lt: until };
    const span = await this.db.xapiStatement.aggregate({
      where: { contentId: { in: ids }, timestamp: before, ...NOT_TEST_USER },
      _min: { timestamp: true },
      _max: { timestamp: true },
    });
    const { timestamp: first } = span._min;
    const { timestamp: last } = span._max;
    if (!first || !last) return new Map();
    const [presences, results] = await Promise.all([
      Promise.all(semesterWindows(first, last).map((window) => presencesIn(this.db, ids, window, until))),
      this.db.xapiStatement.findMany({
        where: {
          contentId: { in: ids },
          timestamp: before,
          subContentId: null,
          verb: { in: ROOT_RESULT_VERBS },
          ...NOT_TEST_USER,
        },
        select: {
          contentId: true,
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
    // PRIVACY: the learner key only tells learners apart in ./learnerSummaries.ts; no summary carries it (D-095).
    const rootResults = results.map(({ learnerKey, ...result }) => ({ ...result, learner: learnerKey }));
    return learnerSummaries(size, presences.flat(), rootResults);
  }
}
