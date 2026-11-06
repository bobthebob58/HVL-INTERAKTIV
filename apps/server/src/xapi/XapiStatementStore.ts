/**
 * XapiStatementStore — the xAPI ingestion's reads and writes on `XapiStatement`: which statement IDs are stored
 * already, what the replay rule needs to know, and the insert that skips an existing ID.
 *
 * Why: the bridge resends what was not acknowledged (a lost answer, the `pagehide` flush), so the insert must store
 *      each statement ID once (D-115), and the caller must learn exactly which rows were new, since only those may
 *      reach the grade enqueuer. The replay rule reads a learner's own earlier rows for one activity.
 * Spec: DATA-012, LTI-011
 * Invariants:
 *   - Every read is bounded by one learner and one activity (the `[learnerKey, contentId, timestamp]` index).
 *   - The insert is one `INSERT … ON CONFLICT DO NOTHING RETURNING`: a statement ID stored before (or by a request
 *     racing this one) is skipped, and the rows returned are exactly those this call inserted.
 *   - PRIVACY: nothing here logs; reads select only the fields the rule needs.
 * Collaborators: ./XapiIngest.ts, ./xapiReplayRule.ts, ../infra/prismaClient.ts.
 * Tests: apps/server/test/xapi/xapiIngest.int.test.ts, apps/server/test/xapi/xapiReplay.int.test.ts
 */
import type { XapiStatement } from '../generated/prisma/client.js';
import type { Database } from '../infra/prismaClient.js';
import type { ReplayHistory } from './xapiReplayRule.js';

/** One learner's statements about one activity in one context and version. */
export interface XapiLearnerScope {
  readonly learnerKey: string;
  readonly contentId: string;
  readonly contextId: string | null;
  readonly contentVersion: number;
}

const RESULT_VERBS = ['answered', 'completed'];
const REPLAY_FIELDS = {
  attemptId: true,
  verb: true,
  subContentId: true,
  scoreRaw: true,
  scoreMax: true,
} as const;

/** `XapiStatement` reads and writes for the ingestion. */
export class XapiStatementStore {
  /**
   * @param db - The server's Prisma client (not owned).
   */
  constructor(private readonly db: Database) {}

  /**
   * Which of these statement IDs are stored already.
   * @param ids - Lower-case statement IDs (UUIDs, checked by the contract).
   * @returns The stored ones.
   */
  async storedIds(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db.xapiStatement.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  /**
   * What the replay rule needs: the stored answers and root results of the batch's page loads, and the learner's
   * latest root result for the activity, context and version.
   * @param scope - The learner, activity, context and version.
   * @param viewIds - The page loads (`viewId`s) the batch names.
   * @returns The history, oldest row first.
   * @spec DATA-012
   */
  async replayHistory(scope: XapiLearnerScope, viewIds: readonly string[]): Promise<ReplayHistory> {
    const { learnerKey, contentId, contextId, contentVersion } = scope;
    const [latestResult, viewRows] = await Promise.all([
      this.db.xapiStatement.findFirst({
        where: {
          learnerKey,
          contentId,
          contextId,
          contentVersion,
          subContentId: null,
          verb: { in: RESULT_VERBS },
        },
        orderBy: { timestamp: 'desc' },
        select: { scoreRaw: true, scoreMax: true },
      }),
      viewIds.length === 0
        ? Promise.resolve([])
        : this.db.xapiStatement.findMany({
            where: {
              learnerKey,
              contentId,
              verb: { in: RESULT_VERBS },
              // WHY: a `viewId` is a lower-case UUID (the contract's pattern), so it holds no LIKE wildcard.
              OR: viewIds.map((viewId) => ({ attemptId: { startsWith: `${viewId}:` } })),
            },
            orderBy: { timestamp: 'asc' },
            select: REPLAY_FIELDS,
          }),
    ]);
    return { viewRows, ...(latestResult ? { latestResult } : {}) };
  }

  /**
   * Inserts rows, skipping any whose statement ID is stored already.
   * @param rows - Planned rows (./xapiBatchPlan.ts).
   * @returns The rows this call inserted, in the order the database returns them.
   * @spec LTI-011
   */
  async insert(rows: readonly XapiStatement[]): Promise<XapiStatement[]> {
    if (rows.length === 0) return [];
    return this.db.xapiStatement.createManyAndReturn({ data: [...rows], skipDuplicates: true });
  }
}
