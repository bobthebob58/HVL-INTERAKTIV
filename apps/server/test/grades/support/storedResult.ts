/**
 * storedResult — stores a gradable root result as the xAPI ingestion would (an `XapiStatement` row of a learner in a
 * Canvas course), so the grade worker, which reads the stored results when it sends, finds it.
 *
 * Why: D-104's amendment of 2026-11-04 computes a placement's score from the learner's stored gradable results of
 *      the placement's activity in its course; the grade tests therefore store each result before they hand it to
 *      the enqueuer, and the reconcile tests store one without handing it on (a job write that failed).
 * Spec: LTI-012
 * Invariants:
 *   - The row is MultiChoice's root `answered` with a maximum of 4 (D-115's table), in the course
 *     `<platformId>:<contextId>` (D-103), with a fresh statement ID; its fields match the `GradableRow` returned.
 *   - Rows go with their activity (`onDelete: Cascade`), so a bench that removes its activity removes them.
 * Collaborators: ./gradeBench.ts, ../../../src/xapi/platformContextKey.ts, ../../../src/grades/GradeJobEnqueuer.ts.
 * Tests: apps/server/test/grades/gradeJobReconcile.int.test.ts, apps/server/test/grades/gradeSyncFlood.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { GradableRow } from '../../../src/grades/GradeJobEnqueuer.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { platformContextKey } from '../../../src/xapi/platformContextKey.js';

/** Where and by whom a result is stored. */
export interface StoredResultScope {
  readonly contentId: string;
  readonly platformId: string;
  /** The bare Canvas course, as the placement holds it. */
  readonly contextId: string;
  readonly learnerKey: string;
}

/** The result itself. */
export interface StoredResultFacts {
  readonly attemptId: string;
  /** 0–1. */
  readonly scaled: number;
  readonly timestamp: Date;
}

/**
 * Stores one gradable root result.
 * @param db - The database.
 * @param scope - The activity, course and learner.
 * @param facts - The attempt, scaled score and time.
 * @returns The row as the ingestion hands it to the enqueuer.
 */
export async function storeGradableResult(
  db: Database,
  scope: StoredResultScope,
  facts: StoredResultFacts,
): Promise<GradableRow> {
  const scoreMax = 4;
  const row = {
    contentId: scope.contentId,
    subContentId: null,
    verb: 'answered',
    scoreMax,
    scaled: facts.scaled,
    attemptId: facts.attemptId,
    timestamp: facts.timestamp,
    academicYear: 2098,
  };
  await db.xapiStatement.create({
    data: {
      ...row,
      id: randomUUID(),
      contentVersion: 1,
      contextId: platformContextKey(scope.platformId, scope.contextId),
      learnerKey: scope.learnerKey,
      scoreRaw: facts.scaled * scoreMax,
      success: facts.scaled === 1,
    },
  });
  return row;
}
