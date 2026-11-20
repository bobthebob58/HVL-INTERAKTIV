/**
 * insightStatements — what the aggregators count from one stored xAPI row: which learner and page load (as small
 * numbers), which part of the activity, the verb, the score, the answer and the time; and how a stored row becomes
 * that.
 *
 * Why: every INS number is an aggregate of `XapiStatement` rows of one activity, version, context and period (D-106,
 *      D-115). Replacing the learner key by a number as the rows are read means no aggregator, test double or log
 *      line downstream ever holds a pseudonym (DATA-002).
 * Spec: INS-001, INS-002, INS-003, INS-005, DATA-012
 * Invariants:
 *   - PRIVACY: `learnerKey` is read only to tell learners apart and is replaced by a number in order of first
 *     appearance; the page load (the view part of `attemptId`, a random UUID per load, D-115) likewise. Neither
 *     leaves this module.
 *   - One converter numbers across all the rows it is given, in however many calls, so rows that arrive in pages
 *     get the same numbers as rows that arrive at once.
 * Collaborators: ./readInsightStatements.ts (the query), ../aggregate/*.
 * Tests: apps/server/test/insight/insightStatements.test.ts, apps/server/test/insight/http/insightReadLimit.int.test.ts
 */

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
 * A converter of stored rows that numbers learners and page loads across every call, for rows that arrive in pages.
 * @returns The converter: one statement per row, in the same order.
 * @spec INS-001
 */
export function insightStatementConverter(): (rows: readonly StoredInsightRow[]) => InsightStatement[] {
  const learnerNumber = numbering();
  const viewNumber = numbering();
  return (rows) =>
    rows.map((row) => {
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
 * Turns stored rows, in time order, into the aggregators' statements.
 * @param rows - The scope's rows, ordered by timestamp, then ID.
 * @returns One statement per row, in the same order, with learners and page loads numbered.
 * @spec INS-001
 */
export function toInsightStatements(rows: readonly StoredInsightRow[]): InsightStatement[] {
  return insightStatementConverter()(rows);
}
