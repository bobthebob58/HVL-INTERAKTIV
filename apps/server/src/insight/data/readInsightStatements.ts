/**
 * readInsightStatements — reads the stored xAPI rows of one insight scope from the database, a page at a time and
 * never more than one view may cover.
 *
 * Why: a view's numbers are counted in the server from the scope's rows (D-106). How many rows a period holds is
 *      not the teacher's to know beforehand, so the read itself has a limit: a scope past it is refused before a
 *      row is read, and below it the rows come in pages that are made small as they arrive (D-122).
 * Spec: INS-001, INS-009, DATA-012
 * Invariants:
 *   - The query filters by `contentId`, `contentVersion`, `contextId` (null for the portal's plays, D-103),
 *     `start <= timestamp < end` and the view's `academicYear` (one key per learner, D-106's amendment of
 *     2026-11-04), and orders by `timestamp`, then `id`, so "first" and "latest" are well defined (the stored
 *     timestamp is a strict order within a batch, D-115). Only the columns insight reads leave the database.
 *   - Only learners' statements are ever stored (D-102), so no role filter is needed; PRIVACY: rows of Canvas's test
 *     student (`testUser`, D-102's amendment of 2026-11-04) are never read, so no view or *k* count holds one.
 *   - One view covers at most `maxStatements` rows: the database is first asked whether the scope holds more,
 *     without a row leaving it, and a scope that does is refused with `viewTooLarge`.
 *   - The rows are read `pageSize` at a time, each page starting after the last row of the one before, and are
 *     turned into statements as they arrive: the server never holds more than one page of stored rows.
 * Collaborators: ./insightStatements.ts (the statements), ../scope/insightScope.ts (the refusal),
 *   ../InsightService.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/insight/http/insightReadLimit.int.test.ts, apps/server/test/insight/insightService.int.test.ts,
 *   apps/server/test/insight/insightPeriodEnd.int.test.ts, apps/server/test/xapi/xapiTestUser.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import { InsightScopeError } from '../scope/insightScope.js';
import { insightStatementConverter, type InsightStatement } from './insightStatements.js';

/** The stored values of one scope (../scope/insightScope.ts). */
export interface InsightStatementFilter {
  readonly contentId: string;
  readonly contentVersion: number;
  /** `<platformId>:<contextId>`, or null for the portal's plays. */
  readonly storedContextId: string | null;
  readonly start: Date;
  readonly end: Date;
  /** The view's academic year (`XapiStatement.academicYear`, the year of the key). */
  readonly academicYear: number;
}

/** How much of the stored statements one view reads (D-122). */
export interface InsightReadLimits {
  /** The most stored statements one view covers; a scope with more is refused. */
  readonly maxStatements: number;
  /** How many rows are read from the database at a time. */
  readonly pageSize: number;
}

/** D-122's limits: 200 000 statements a view, read 10 000 at a time. */
export const INSIGHT_READ_LIMITS: InsightReadLimits = { maxStatements: 200_000, pageSize: 10_000 };

const COLUMNS = {
  id: true,
  learnerKey: true,
  attemptId: true,
  subContentId: true,
  verb: true,
  scoreRaw: true,
  scoreMax: true,
  success: true,
  response: true,
  timestamp: true,
} as const;

/**
 * Reads the statements of one scope.
 * @param db - The database.
 * @param filter - The activity, version, context, period and academic year.
 * @param limits - The most statements a view covers and the page size; D-122's outside tests.
 * @returns The statements in time order.
 * @throws InsightScopeError `viewTooLarge` when the scope holds more than `limits.maxStatements` rows.
 * @spec INS-001
 */
export async function readInsightStatements(
  db: Database,
  filter: InsightStatementFilter,
  limits: InsightReadLimits = INSIGHT_READ_LIMITS,
): Promise<InsightStatement[]> {
  const scope = {
    contentId: filter.contentId,
    contentVersion: filter.contentVersion,
    contextId: filter.storedContextId,
    academicYear: filter.academicYear,
    // PRIVACY: Canvas's test students are left out of every aggregate and k count (D-102's amendment).
    testUser: false,
  };
  const period = { gte: filter.start, lt: filter.end };
  // SECURITY: asked before any row is read, so a scope past the limit costs the server no memory (D-122).
  // WHY: in time order, which the `[contentId, contextId, timestamp]` index gives, so the database can stop at the
  // first row past the limit however many rows the scope holds.
  const beyond = await db.xapiStatement.findMany({
    where: { ...scope, timestamp: period },
    select: { id: true },
    orderBy: { timestamp: 'asc' },
    skip: limits.maxStatements,
    take: 1,
  });
  if (beyond.length > 0) throw new InsightScopeError('viewTooLarge');
  const convert = insightStatementConverter();
  const statements: InsightStatement[] = [];
  let last: { readonly timestamp: Date; readonly id: string } | undefined;
  for (;;) {
    const page = await db.xapiStatement.findMany({
      // WHY: the next page starts after the last row read, by the order's own columns; a row removed meanwhile
      // (an erasure) cannot cut the read short, as a cursor on that row would.
      where: last
        ? {
            ...scope,
            timestamp: { gte: last.timestamp, lt: filter.end },
            NOT: { timestamp: last.timestamp, id: { lte: last.id } },
          }
        : { ...scope, timestamp: period },
      select: COLUMNS,
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: limits.pageSize,
    });
    // WHY: the scope was within the limit a moment ago; this holds the limit also if rows came in between.
    if (statements.length + page.length > limits.maxStatements) throw new InsightScopeError('viewTooLarge');
    for (const statement of convert(page)) statements.push(statement);
    last = page.at(-1);
    if (page.length < limits.pageSize || !last) return statements;
  }
}
