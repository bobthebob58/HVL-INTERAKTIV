/**
 * xapiReplayRule — D-115's replay rule: a root `completed` that H5P re-sends with no learner action since the page
 * load's previous result, with the same score as the learner's latest result, is not a new result.
 *
 * Why: probe P1 saw CoursePresentation re-send its scored `completed` on resume (opening on the summary slide) and
 *      InteractiveBook and QuestionSet offer the same submission again after a reload. Stored, each would count as an
 *      attempt in insight and queue a grade (D-115). The bridge cannot tell a replay; the server can, from the page
 *      load's stored answers and the learner's latest stored result.
 * Spec: DATA-012, LTI-012
 * Invariants:
 *   - A root `completed` is a replay when (a) its page load (the `viewId` of its `attemptId`) stored no `answered`
 *     since its previous root result, or since the load when it has none, and (b) its `scoreRaw` and `scoreMax`
 *     equal those of the learner's latest stored root result for the same activity, context and version. With no
 *     earlier result it is never a replay (a first submission after a reload is kept).
 *   - Only root `completed` can be a replay; a root `answered` (MultiChoice, Blanks, DragText) never is.
 *   - BranchingScenario is exempt: an end screen is reached by navigation alone (D-115); the caller decides that.
 *   - The state is fed in time order: first the stored rows of the batch's page loads, then each planned row.
 * Collaborators: ./xapiRootTests.ts (`isStoredRootResult`), ./xapiBatchPlan.ts, ./XapiStatementStore.ts (reads the
 *   history).
 * Tests: apps/server/test/xapi/xapiBatchPlan.test.ts, apps/server/test/xapi/xapiReplayRule.test.ts
 */
import { isStoredRootResult } from './xapiRootTests.js';

/** The fields of a stored or planned statement the rule reads. */
export interface ReplayFacts {
  readonly attemptId: string;
  readonly verb: string;
  readonly subContentId: string | null;
  readonly scoreRaw: number | null;
  readonly scoreMax: number | null;
}

/** A score as the rule compares it. */
export type ReplayScore = Pick<ReplayFacts, 'scoreRaw' | 'scoreMax'>;

/** What is stored already, as the rule needs it. */
export interface ReplayHistory {
  /** The stored `answered` and root results of the batch's page loads, oldest first. */
  readonly viewRows: readonly ReplayFacts[];
  /** The learner's latest stored root result for the activity, context and version, if any. */
  readonly latestResult?: ReplayScore;
}

/**
 * The page load an attempt belongs to.
 * @param attemptId - `<viewId>:<n>`, checked by the contract's schema.
 * @returns The `viewId`.
 */
export const viewIdOf = (attemptId: string): string => attemptId.slice(0, attemptId.indexOf(':'));

/** The replay rule's knowledge of one learner's statements about one activity, context and version. */
export class ReplayState {
  /** Per page load: whether an `answered` was stored since its latest root result (or since the load). */
  private readonly answeredSinceResult = new Map<string, boolean>();
  private latest: ReplayScore | undefined;

  /**
   * @param history - The stored rows of the batch's page loads and the learner's latest result.
   */
  constructor(history: ReplayHistory) {
    this.latest = history.latestResult;
    for (const row of history.viewRows) this.markView(row);
  }

  /**
   * Records a row the batch will store, so that later items of the batch see it.
   * @param row - A planned row, in batch order.
   */
  record(row: ReplayFacts): void {
    this.markView(row);
    if (isStoredRootResult(row)) this.latest = { scoreRaw: row.scoreRaw, scoreMax: row.scoreMax };
  }

  /**
   * Tells whether a root result is a replay (see the module's invariants).
   * @param row - The planned row of a root result.
   * @returns True for a root `completed` with no answer since its page load's previous result and the same score
   *   as the learner's latest result.
   * @spec DATA-012
   */
  isReplay(row: ReplayFacts): boolean {
    if (row.verb !== 'completed' || row.subContentId !== null) return false;
    if (this.answeredSinceResult.get(viewIdOf(row.attemptId)) === true) return false;
    const latest = this.latest;
    return latest !== undefined && latest.scoreRaw === row.scoreRaw && latest.scoreMax === row.scoreMax;
  }

  private markView(row: ReplayFacts): void {
    const view = viewIdOf(row.attemptId);
    // WHY: a root `answered` is itself the page load's latest result, so it starts a new "since", not an answer.
    if (isStoredRootResult(row)) this.answeredSinceResult.set(view, false);
    else if (row.verb === 'answered') this.answeredSinceResult.set(view, true);
  }
}
