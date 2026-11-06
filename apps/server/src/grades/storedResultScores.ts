/**
 * storedResultScores — reads, when a score is sent, the learner's stored gradable results that decide a placement's
 * attempt policy: the best one and those with the latest timestamp.
 *
 * Why: D-104's amendment of 2026-11-04 (the step-3 security review) keeps one grade job per placement and learner and
 *      computes its score from the stored results at send time, so the queue never grows with the number of results.
 *      A statement names no placement (DATA-012), so a placement's results are the learner's gradable root results
 *      (D-115) of the placement's activity in its course (`<platformId>:<contextId>`, D-103).
 * Spec: LTI-012
 * Invariants:
 *   - Gradable as ../xapi/xapiRootTests.ts's `isGradableResult` says: no `subContentId`, the verb `answered` or
 *     `completed`, `scoreMax` above 0; and a `scaled` score, which the mapper stores with every scored result.
 *   - The rows returned give `policyScore` (./attemptPolicyScore.ts) the same answer as all of the learner's rows:
 *     the best is among them, and so is every row with the latest timestamp, from which D-115's result order picks
 *     the latest; `mastery` holds over all exactly when it holds for the best.
 *   - Three reads, whatever number of results the learner stored: the newest, its ties, and the best, which sorts
 *     the learner's rows of that activity by score (no index orders by score), so a flood of results makes that
 *     read longer, never the queue.
 *   - A placement whose course cannot form a key (D-103) has no stored results.
 * Collaborators: ./gradeJobSend.ts (the caller), ./attemptPolicyScore.ts, ../xapi/platformContextKey.ts.
 * Tests: apps/server/test/grades/storedResultScores.int.test.ts, apps/server/test/grades/gradeSyncWorker.int.test.ts
 */
import type { Prisma } from '../generated/prisma/client.js';
import type { Database } from '../infra/prismaClient.js';
import { platformContextKey } from '../xapi/platformContextKey.js';
import type { AttemptScore } from './attemptPolicyScore.js';

/** Where a placement's results are stored: its activity and course. */
export interface PlacementResultScope {
  readonly platformId: string;
  /** The bare Canvas course, as `LtiPlacement.contextId` holds it. */
  readonly contextId: string;
  readonly contentId: string;
}

/**
 * A result's score as a job and the policy hold it.
 * @param scaled - The result's scaled score, 0–1 (H5P rounds it to four decimals).
 * @returns `scaled × 100`, rounded to two decimals, so the score is exact without float noise.
 */
export const scoreGivenOf = (scaled: number): number => Math.round(scaled * 10_000) / 100;

/** The stored context key of the placement's course, or undefined when none can be stored (D-103). */
function courseKeyOf(scope: PlacementResultScope): string | undefined {
  try {
    return platformContextKey(scope.platformId, scope.contextId);
  } catch {
    return undefined;
  }
}

/**
 * The `XapiStatement` filter for a learner's gradable results in a placement.
 * @param scope - The placement's activity and course.
 * @param learnerKey - The learner.
 * @returns The filter, or undefined when the placement's course cannot hold statements.
 */
export function gradableResultsWhere(
  scope: PlacementResultScope,
  learnerKey: string,
): Prisma.XapiStatementWhereInput | undefined {
  const contextId = courseKeyOf(scope);
  if (contextId === undefined) return undefined;
  return {
    learnerKey,
    contentId: scope.contentId,
    contextId,
    subContentId: null,
    verb: { in: ['answered', 'completed'] },
    scoreMax: { gt: 0 },
    scaled: { not: null },
  };
}

const SELECT = { id: true, attemptId: true, scaled: true, timestamp: true } as const;

/**
 * The learner's stored results that decide the placement's policy score.
 * @param db - The database.
 * @param scope - The placement's activity and course.
 * @param learnerKey - The learner.
 * @returns The best result and those with the latest timestamp, as attempt scores; empty when none is stored.
 * @spec LTI-012
 */
export async function policyResultScores(
  db: Database,
  scope: PlacementResultScope,
  learnerKey: string,
): Promise<AttemptScore[]> {
  const where = gradableResultsWhere(scope, learnerKey);
  if (where === undefined) return [];
  const best = await db.xapiStatement.findFirst({ where, orderBy: [{ scaled: 'desc' }], select: SELECT });
  const newest = await db.xapiStatement.findFirst({
    where,
    orderBy: [{ timestamp: 'desc' }],
    select: { timestamp: true },
  });
  if (best === null || newest === null) return [];
  const latest = await db.xapiStatement.findMany({
    where: { ...where, timestamp: newest.timestamp },
    select: SELECT,
  });
  const rows = new Map([best, ...latest].map((row) => [row.id, row]));
  return [...rows.values()].map((row) => ({
    attemptId: row.attemptId,
    scoreGiven: scoreGivenOf(row.scaled ?? 0),
    resultAt: row.timestamp,
  }));
}
