/**
 * insightStatements — reads the stored xAPI rows of one insight scope and hands the aggregators what they count:
 * which learner and page load (as small numbers), which part of the activity, the verb, the score, the answer and
 * the time.
 *
 * Why: every INS number is an aggregate of `XapiStatement` rows of one activity, version, context and period (D-106,
 *      D-115). Replacing the learner key by a number as the rows are read means no aggregator, test double or log
 *      line downstream ever holds a pseudonym (DATA-002), and only the columns insight reads leave the database.
 * Spec: INS-001, INS-002, INS-003, INS-005, DATA-012
 * Invariants:
 *   - PRIVACY: `learnerKey` is read only to tell learners apart and is replaced by a number in order of first
 *     appearance; the page load (the view part of `attemptId`, a random UUID per load, D-115) likewise. Neither
 *     leaves this module.
 *   - The query filters by `contentId`, `contentVersion`, `contextId` (null for the portal's plays, D-103) and
 *     `start <= timestamp < end`, and orders by `timestamp`, then `id`, so "first" and "latest" are well defined
 *     (the stored timestamp is a strict order within a batch, D-115).
 *   - Only learners' statements are ever stored (D-102), so no role filter is needed.
 * Collaborators: ../../infra/prismaClient.ts, ../scope/insightScope.ts, ../InsightService.ts,
 *   ../aggregate/*.
 * Tests: apps/server/test/insight/insightStatements.test.ts, apps/server/test/insight/insightService.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** One stored statement as the aggregators see it: no learner key, no attempt ID, no context. */
export interface InsightStatement {
  /** The learner, as a number that means nothing outside this read. */
  readonly learner: number;
  /** The page load, as a number that means nothing outside this read. */
  readonly view: number;
  /** The `subContentId`, or null for a statement of the activity itself (the root). */
  readonly item: string | null;
  /** `attempted`, `answered` or `completed` (D-115 stores no other verb). */
  readonly verb: string;
  readonly scoreRaw: number | null;
  readonly scoreMax: number | null;
  readonly success: boolean | null;
  /** Choice indices or gap text joined by `[,]` (DATA-012), or null. */
  readonly response: string | null;
  /** The stored time in milliseconds since the epoch. */
  readonly at: number;
}

/** The stored columns this module reads. */
export interface StoredInsightRow {
  readonly learnerKey: string;
  readonly attemptId: string;
  readonly subContentId: string | null;
  readonly verb: string;
  readonly scoreRaw: number | null;
  readonly scoreMax: number | null;
  readonly success: boolean | null;
  readonly response: string | null;
  readonly timestamp: Date;
}

/** The stored values of one scope (../scope/insightScope.ts). */
export interface InsightStatementFilter {
  readonly contentId: string;
  readonly contentVersion: number;
  /** `<platformId>:<contextId>`, or null for the portal's plays. */
  readonly storedContextId: string | null;
  readonly start: Date;
  readonly end: Date;
}

/** Numbers things in order of first appearance. */
function numbering(): (key: string) => number {
  const numbers = new Map<string, number>();
  return (key) => {
    const known = numbers.get(key);
    if (known !== undefined) return known;
    numbers.set(key, numbers.size);
    return numbers.size - 1;
  };
}

/**
 * Turns stored rows, in time order, into the aggregators' statements.
 * @param rows - The scope's rows, ordered by timestamp, then ID.
 * @returns One statement per row, in the same order, with learners and page loads numbered.
 * @spec INS-001
 */
export function toInsightStatements(rows: readonly StoredInsightRow[]): InsightStatement[] {
  const learnerNumber = numbering();
  const viewNumber = numbering();
  return rows.map((row) => {
    // WHY: `<viewId>:<n>` (D-115); the view part is everything before the last colon.
    const viewId = row.attemptId.slice(0, Math.max(0, row.attemptId.lastIndexOf(':')));
    return {
      // PRIVACY: the learner key and the view ID stop here; aggregates are built from these numbers (DATA-002).
      learner: learnerNumber(row.learnerKey),
      view: viewNumber(`${row.learnerKey}\u0000${viewId}`),
      item: row.subContentId,
      verb: row.verb,
      scoreRaw: row.scoreRaw,
      scoreMax: row.scoreMax,
      success: row.success,
      response: row.response,
      at: row.timestamp.getTime(),
    };
  });
}

/**
 * Reads the statements of one scope.
 * @param db - The database.
 * @param filter - The activity, version, context and period.
 * @returns The statements in time order.
 * @spec INS-001
 */
export async function readInsightStatements(
  db: Database,
  filter: InsightStatementFilter,
): Promise<InsightStatement[]> {
  const rows = await db.xapiStatement.findMany({
    where: {
      contentId: filter.contentId,
      contentVersion: filter.contentVersion,
      contextId: filter.storedContextId,
      timestamp: { gte: filter.start, lt: filter.end },
    },
    select: {
      learnerKey: true,
      attemptId: true,
      subContentId: true,
      verb: true,
      scoreRaw: true,
      scoreMax: true,
      success: true,
      response: true,
      timestamp: true,
    },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });
  return toInsightStatements(rows);
}
