/**
 * participation — INS-001's numbers for one view: learners who started and completed, the completion rate, the median
 * time on task and the median number of attempts, each suppressed below k.
 *
 * Why: the participation overview tells a teacher, before the seminar, how many did the pre-work. D-115 decides what
 *      each number reads, since H5P marks no attempts: started is any stored statement, completed a stored root
 *      result, attempts the stored root results, and time on task runs from each page load's first to its last
 *      stored statement (never `durationMs`, whose meaning differs by type).
 * Spec: INS-001, INS-006, LTI-008
 * Invariants:
 *   - Where the type cannot send a root result (../content/activityCapabilities.ts) and none is stored, completed,
 *     the rate, its base and the attempts are null ("not available"), never 0 (D-115).
 *   - The rate's base is the course's NRPS learner count when one is given (LTI-008), else the learners who started
 *     ("of those who started"). A count older than the course's latest changes can be below the completers; the rate
 *     is then capped at 100 %.
 *   - PRIVACY: started is the group every other number is about: when it is suppressed, so is everything else. The
 *     rate is suppressed with completed (it would reveal it) and when its base is below k; the median time needs k
 *     learners with a measured time (a page load with two or more statements); the median attempts need k
 *     completers (INS-006).
 *   - Time is in minutes with one decimal: the sum, per learner, of last − first over their page loads.
 * Collaborators: ./learnerAnswers.ts, ../suppression/insightCells.ts, ../../xapi/xapiRootTests.ts
 *   (`isStoredRootResult`), ../buildInsightReport.ts.
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/videoLearners.test.ts
 */
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import { isStoredRootResult } from '../../xapi/xapiRootTests.js';
import type { InsightStatement } from '../data/insightStatements.js';
import type { ParticipationInsight } from '../insightReport.js';
import {
  countCell,
  isShowableCount,
  medianCell,
  rateCell,
  SUPPRESSED_CELL,
  withinShownGroup,
} from '../suppression/insightCells.js';
import { learnersOf, medianOf } from './learnerAnswers.js';

/** What the participation numbers need besides the statements. */
export interface ParticipationFacts {
  /** Whether the type can send a root result as configured (D-115). */
  readonly sendsRootResult: boolean;
  /** The course's active learners from NRPS (LTI-008), or undefined (the portal, or no count stored). */
  readonly courseLearners: number | undefined;
}

const MINUTE_MS = 60_000;

/** Per learner, the summed time of their page loads that hold two or more statements. */
function timeOnTaskByLearner(statements: readonly InsightStatement[]): number[] {
  const views = new Map<number, { learner: number; first: number; last: number; count: number }>();
  for (const { view, learner, at } of statements) {
    const known = views.get(view);
    views.set(view, {
      learner,
      first: known?.first ?? at,
      last: at,
      count: (known?.count ?? 0) + 1,
    });
  }
  const perLearner = new Map<number, number>();
  for (const { learner, first, last, count } of views.values()) {
    // WHY: one statement has no interval; reading before it and time after it are not counted (D-115 residual).
    if (count >= 2) perLearner.set(learner, (perLearner.get(learner) ?? 0) + (last - first));
  }
  return [...perLearner.values()];
}

/**
 * The root results per learner who has one.
 * @param statements - The view's statements.
 * @returns The attempts (stored root results) of each completer.
 */
function attemptsByLearner(statements: readonly InsightStatement[]): number[] {
  const attempts = new Map<number, number>();
  for (const statement of statements) {
    if (isStoredRootResult({ subContentId: statement.item, verb: statement.verb })) {
      attempts.set(statement.learner, (attempts.get(statement.learner) ?? 0) + 1);
    }
  }
  return [...attempts.values()];
}

/**
 * INS-001's numbers.
 * @param size - The minimum group size.
 * @param statements - The view's statements in stored order.
 * @param facts - Whether a root result can be sent, and the course's learner count.
 * @returns The suppressed participation overview.
 * @spec INS-001
 */
export function participationInsight(
  size: MinimumGroupSize,
  statements: readonly InsightStatement[],
  facts: ParticipationFacts,
): ParticipationInsight {
  const started = learnersOf(statements).size;
  const startedShown = isShowableCount(size, started);
  const attempts = attemptsByLearner(statements);
  const completed = attempts.length;
  const times = timeOnTaskByLearner(statements);
  const minutes = Math.round(medianOf(times) / (MINUTE_MS / 10)) / 10;
  const medianMinutesOnTask = withinShownGroup(medianCell(size, minutes, times.length), startedShown);
  // WHY: "not available, never 0" — unless results are stored anyway (e.g. from a version with a submit screen).
  if (!facts.sendsRootResult && completed === 0) {
    return {
      started: countCell(size, started),
      completed: null,
      completionRate: null,
      completionBase: null,
      courseLearners: null,
      medianMinutesOnTask,
      medianAttempts: null,
    };
  }
  const completedCell = withinShownGroup(countCell(size, completed), startedShown);
  const base = facts.courseLearners === undefined ? started : facts.courseLearners;
  const rate = completedCell.suppressed ? SUPPRESSED_CELL : rateCell(size, completed / base, base);
  return {
    started: countCell(size, started),
    completed: completedCell,
    completionRate: withinShownGroup(rate, startedShown),
    completionBase: facts.courseLearners === undefined ? 'started' : 'course',
    courseLearners: facts.courseLearners === undefined ? null : countCell(size, facts.courseLearners),
    medianMinutesOnTask,
    medianAttempts: withinShownGroup(medianCell(size, medianOf(attempts), completed), startedShown),
  };
}
