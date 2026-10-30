/**
 * xapiMemoryStore — plans batches one after another against rows kept in memory, reading what is "stored" exactly
 * as `XapiStatementStore` reads PostgreSQL, so the pure rules can be tested over several requests.
 *
 * Why: the replay rule (D-115) looks at earlier requests: CoursePresentation's resume and a re-submission after a
 *      reload arrive in a later batch than the result they repeat. A memory model keeps those unit tests fast; the
 *      integration tests prove that PostgreSQL gives the same answers.
 * Spec: DATA-012
 * Invariants:
 *   - `viewRows` are the stored `answered` and `completed` rows whose `attemptId` starts with a batch's `viewId`,
 *     oldest first; `latestResult` is the learner's latest stored root result for the same activity, context and
 *     version; stored IDs are the batch's IDs already kept.
 * Collaborators: ../../../src/xapi/xapiBatchPlan.ts, ../../../src/xapi/XapiStatementStore.ts (the model).
 * Tests: apps/server/test/xapi/xapiBatchPlan.test.ts, apps/server/test/xapi/xapiReplayRule.test.ts
 */
import type { XapiStatement } from '../../../src/generated/prisma/client.js';
import {
  batchKeys,
  parseXapiItems,
  planXapiBatch,
  type XapiBatchPlan,
} from '../../../src/xapi/xapiBatchPlan.js';
import { isStoredRootResult } from '../../../src/xapi/xapiRootTests.js';
import type { XapiBatchFacts } from '../../../src/xapi/xapiStatementRow.js';

/** Plans batches against the rows planned before. */
export class XapiMemoryStore {
  /** Every row stored so far, in storing order. */
  readonly rows: XapiStatement[] = [];
  private clock: number;

  /**
   * @param mainLibrary - The activity's main library machine name (for the replay exemption).
   * @param start - The receive time of the first batch; each later batch arrives one second after the previous.
   */
  constructor(
    private readonly mainLibrary: string,
    start = Date.parse('2026-10-30T10:00:00Z'),
  ) {
    this.clock = start;
  }

  /**
   * Plans one batch and keeps its rows.
   * @param statements - The posted statements.
   * @param facts - The server's facts for the batch.
   * @returns The plan.
   */
  post(statements: readonly unknown[], facts: XapiBatchFacts): XapiBatchPlan {
    const items = parseXapiItems(statements);
    const keys = batchKeys(items);
    const kept = new Set(this.rows.map((row) => row.id));
    const scope = (row: XapiStatement) =>
      row.learnerKey === facts.learnerKey &&
      row.contentId === facts.contentId &&
      row.contextId === facts.contextId &&
      row.contentVersion === facts.contentVersion;
    const results = this.rows.filter((row) => scope(row) && isStoredRootResult(row));
    const latest = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    const viewRows = this.rows
      .filter((row) => row.learnerKey === facts.learnerKey && row.contentId === facts.contentId)
      .filter((row) => ['answered', 'completed'].includes(row.verb))
      .filter((row) => keys.viewIds.some((viewId) => row.attemptId.startsWith(`${viewId}:`)))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const plan = planXapiBatch({
      items,
      facts,
      mainLibrary: this.mainLibrary,
      storedIds: new Set(keys.statementIds.filter((id) => kept.has(id))),
      history: { viewRows, ...(latest ? { latestResult: latest } : {}) },
      receivedAt: new Date(this.clock),
    });
    this.clock += 1000;
    this.rows.push(...plan.rows);
    return plan;
  }
}
