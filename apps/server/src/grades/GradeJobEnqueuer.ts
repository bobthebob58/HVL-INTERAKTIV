/**
 * GradeJobEnqueuer — takes a learner's newly stored gradable results into their grade job for the Canvas gradebook;
 * the xAPI ingestion calls it after its rows commit.
 *
 * Why: LTI-012 queues a score for every scored root result in a graded Canvas placement, and learning must never
 *      wait for Canvas, so the queue is a table (`GradeSyncJob`) that a worker drains. D-104 writes a job only for a
 *      learner principal in a Canvas launch, a gradable root result and a placement with a line item; D-115 defines
 *      the gradable root result and its score (`scaled × 100`). D-104's amendment of 2026-11-04 keeps one job per
 *      placement and learner, whose score the worker computes from the stored results when it sends, so a learner
 *      who stores a flood of results still holds one place in the queue.
 * Spec: LTI-012, DATA-002
 * Invariants:
 *   - Nothing is written for anyone whose highest role is not `learner`, for a portal play, for a launch without a
 *     resource link, without the request's LTI `sub`, or for a placement without a `lineItemUrl` (D-102, D-104).
 *   - SPEC-DEVIATION: D-115 — only rows that `isGradableResult` accepts (a stored root result with `scoreMax` above 0)
 *     queue a score; LTI-012's "no `subContentId`" alone is not the root test.
 *   - The placement is the launch's `(platformId, contextId, resourceLinkId)`, and a row about another activity than
 *     the placement's is skipped, so a link pointed at a new activity never grades the old one into its column.
 *   - One job write per call, whatever number of rows: the newest gradable row in D-115's result order is taken in
 *     (./gradeJobUpsert.ts), since the worker reads every stored result anyway.
 *   - PRIVACY: the `sub` is encrypted (`grade-lti-sub`) before it reaches the database and is never logged; logs hold
 *     counts only (DATA-002, DATA-009).
 * Collaborators: ./gradeJobUpsert.ts, ./attemptPolicyScore.ts (`compareResultOrder`), ./storedResultScores.ts
 *   (`scoreGivenOf`), ../xapi/xapiRootTests.ts (`isGradableResult`), ../xapi/XapiIngest.ts (calls `onStored`),
 *   ../auth/Principal.ts, ../security/keys/DataEncryption.ts.
 * Tests: apps/server/test/grades/gradeJobEnqueuer.int.test.ts
 */
import type { Logger } from 'pino';
import { highestRole, type Principal } from '../auth/Principal.js';
import type { Database } from '../infra/prismaClient.js';
import type { DataEncryption } from '../security/keys/DataEncryption.js';
import { isGradableResult } from '../xapi/xapiRootTests.js';
import { compareResultOrder, type AttemptScore } from './attemptPolicyScore.js';
import { upsertGradeJob } from './gradeJobUpsert.js';
import { scoreGivenOf } from './storedResultScores.js';

/** The fields of a stored `XapiStatement` that the enqueuer reads; a stored row has them all. */
export interface GradableRow {
  readonly contentId: string;
  readonly subContentId: string | null;
  readonly verb: string;
  readonly scoreMax: number | null;
  readonly scaled: number | null;
  /** `<viewId>:<n>` (D-115). */
  readonly attemptId: string;
  /** The server's receive time plus the item's place in its batch (D-115). */
  readonly timestamp: Date;
  /** The year of the secret behind the learner key (D-107). */
  readonly academicYear: number;
}

/** What the enqueuer needs. */
export interface GradeJobEnqueuerDeps {
  readonly db: Database;
  readonly encryption: Pick<DataEncryption, 'encrypt'>;
  readonly logger: Logger;
  /** The server's clock; a new job's creation time. Defaults to the system clock. */
  readonly clock?: () => Date;
}

/** How many jobs one call wrote: at most one, created or updated. */
export interface EnqueueCounts {
  readonly created: number;
  readonly updated: number;
}

const NONE: EnqueueCounts = { created: 0, updated: 0 };

/** A stored row as an attempt score, for D-115's result order. */
const attemptScoreOf = (row: GradableRow): AttemptScore => ({
  attemptId: row.attemptId,
  scoreGiven: scoreGivenOf(row.scaled ?? 0),
  resultAt: row.timestamp,
});

/** Writes grade jobs for stored gradable results (LTI-012, D-104). */
export class GradeJobEnqueuer {
  /**
   * @param deps - Database, encryption, logger and an optional clock.
   */
  constructor(private readonly deps: GradeJobEnqueuerDeps) {}

  /**
   * The xAPI ingestion's listener of stored rows (`XapiStoredListener`): queues their gradable results.
   * @param rows - The rows a batch stored, oldest first.
   * @param principal - Who sent them.
   * @param request - The request's LTI `sub`, when it came from Canvas.
   * @returns Nothing; the jobs are written when it resolves.
   */
  readonly onStored = async (
    rows: readonly GradableRow[],
    principal: Principal,
    request: { readonly ltiSubject?: string | undefined },
  ): Promise<void> => {
    await this.enqueue(rows, principal, request.ltiSubject);
  };

  /**
   * Takes the newest gradable result among the rows into the learner's job in the launch's placement.
   * @param rows - Stored statements of one learner and activity.
   * @param principal - Who sent them.
   * @param ltiSubject - The request's LTI `sub`; PRIVACY: stored only encrypted.
   * @returns Whether a job was created or updated.
   * @spec LTI-012
   */
  async enqueue(
    rows: readonly GradableRow[],
    principal: Principal,
    ltiSubject: string | undefined,
  ): Promise<EnqueueCounts> {
    const launch = principal.lti;
    // PRIVACY: previews and teachers' plays are never graded, and a portal play has no gradebook (D-102).
    if (highestRole(principal.roles) !== 'learner' || !launch?.resourceLinkId) return NONE;
    const gradable = rows.filter((row) => isGradableResult(row) && row.scaled !== null);
    if (gradable.length === 0) return NONE;
    if (!ltiSubject) {
      this.deps.logger.warn(
        { event: 'grade.enqueue.no-subject', results: gradable.length },
        'grade not queued',
      );
      return NONE;
    }
    const placement = await this.deps.db.ltiPlacement.findUnique({
      where: {
        platformId_contextId_resourceLinkId: {
          platformId: launch.platformId,
          contextId: launch.contextId,
          resourceLinkId: launch.resourceLinkId,
        },
      },
      select: { id: true, contentId: true, lineItemUrl: true },
    });
    if (!placement?.lineItemUrl) return NONE;
    const ofActivity = gradable.filter(
      (row) => row.contentId.toLowerCase() === placement.contentId.toLowerCase(),
    );
    const newest = ofActivity
      .map((row) => ({ row, score: attemptScoreOf(row) }))
      .sort((a, b) => compareResultOrder(a.score, b.score))
      .at(-1);
    if (newest === undefined) return NONE;
    const now = (this.deps.clock ?? (() => new Date()))();
    // PRIVACY: the only raw learner ID kept beyond the launch, encrypted, and cleared 30 days after the job stops.
    const ltiSubEncrypted = new Uint8Array(this.deps.encryption.encrypt('grade-lti-sub', ltiSubject));
    const write = await upsertGradeJob(
      this.deps.db,
      {
        placementId: placement.id,
        learnerKey: principal.learnerKey,
        ...newest.score,
        academicYear: newest.row.academicYear,
        ltiSubEncrypted,
      },
      now,
    );
    return { ...NONE, [write]: 1 };
  }
}
