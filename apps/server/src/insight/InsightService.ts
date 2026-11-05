/**
 * InsightService — the insight core's one entry point for the API: the full, already suppressed insight of one
 * activity in one context, version and period, and the list of contexts an activity can be viewed for.
 *
 * Why: the Innsikt tabs (D-101, D-106) and the CSV export (INS-009) answer from one report; building it behind one
 *      facade keeps the database, the content store and the NRPS count out of the HTTP layer, and means nothing
 *      leaves the core that INS-006 has not passed.
 * Spec: INS-001, INS-002, INS-003, INS-005, INS-006, PROD-013
 * Invariants:
 *   - PRIVACY: the answer is an `InsightReport`: aggregates only, each number a shown or suppressed cell; there is no
 *     method that returns per-learner rows (INS-006). No learner key, count or answer is logged here.
 *   - Who may see which context is checked before this (INS-007, the API workstream); this resolves the scope it is
 *     given: an activity that does not exist is `activityUnavailable`, a version outside 1..current
 *     `versionUnavailable`, a malformed context `contextInvalid` (./scope/insightScope.ts).
 *   - The question texts come from the activity's current parameters through the content store
 *     (`IContentStorage.getParameters`, ../h5p/storage/PrismaContentStorage.ts); the course's NRPS count from
 *     ../lti/nrps/NrpsLearnerCountStore.ts, only for a Canvas context.
 * Collaborators: ./scope/insightScope.ts, ./scope/activityContexts.ts, ./data/insightStatements.ts,
 *   ./buildInsightReport.ts, ../h5p/storage/PrismaContentStorage.ts, ../lti/nrps/NrpsLearnerCountStore.ts, the
 *   insight API (apps/server/src/insight/http, the API workstream).
 * Tests: apps/server/test/insight/insightService.int.test.ts
 */
import type { InsightContext } from '@hvl-interaktiv/api-contract';
import { isContentUuid } from '../h5p/contentIds.js';
import type { Database } from '../infra/prismaClient.js';
import type { NrpsLearnerCount } from '../lti/nrps/NrpsLearnerCountStore.js';
import type { MinimumGroupSize } from '../privacy/minimumGroupSize.js';
import { parsePlatformContextKey } from '../xapi/platformContextKey.js';
import { buildInsightReport } from './buildInsightReport.js';
import { readInsightStatements } from './data/insightStatements.js';
import type { InsightReport } from './insightReport.js';
import { listActivityContexts } from './scope/activityContexts.js';
import {
  InsightScopeError,
  resolveInsightScope,
  storedContextOf,
  type InsightScopeRequest,
} from './scope/insightScope.js';

/** The parts of H5P's content store insight reads (`PrismaContentStorage` satisfies it). */
export interface InsightContentSource {
  /** The activity's h5p.json metadata; insight reads `mainLibrary`. */
  getMetadata(contentId: string): Promise<{ readonly mainLibrary: string }>;
  /** The activity's current parameters (content.json). */
  getParameters(contentId: string): Promise<unknown>;
}

/** What the service needs. */
export interface InsightServiceDeps {
  readonly db: Database;
  readonly content: InsightContentSource;
  /** The NRPS learner counts (LTI-008); without it, every completion rate is "of those who started". */
  readonly learnerCounts?: { read(contextKey: string): Promise<NrpsLearnerCount | undefined> };
  /** *k* (`minimumGroupSize(env.MIN_GROUP_SIZE)`). */
  readonly groupSize: MinimumGroupSize;
  /** The current moment; the system clock outside tests. */
  readonly clock?: () => Date;
}

/** Builds insight views. */
export class InsightService {
  /**
   * @param deps - Database, content store, NRPS counts, *k* and clock.
   */
  constructor(private readonly deps: InsightServiceDeps) {}

  /**
   * The contexts an activity's insight can be shown for.
   * @param contentId - The activity, as stored.
   * @returns The portal, then each Canvas course it is placed in, with its course label.
   * @spec INS-007
   */
  contexts(contentId: string): Promise<InsightContext[]> {
    return listActivityContexts(this.deps.db, contentId);
  }

  /**
   * The full insight of one activity in one context, version and period, already suppressed.
   * @param request - The activity, context (`portal` or `<platformId>:<contextId>`), period and version.
   * @returns The report: participation, item difficulty, misconceptions and, for a video, engagement.
   * @throws InsightScopeError `activityUnavailable`, `versionUnavailable` or `contextInvalid`.
   * @example
   * const report = await insight.forActivity({ contentId, context: 'portal', period: '7d' });
   * @spec INS-001
   */
  async forActivity(request: InsightScopeRequest): Promise<InsightReport> {
    const { db, content, groupSize } = this.deps;
    const now = (this.deps.clock ?? (() => new Date()))();
    if (!isContentUuid(request.contentId)) throw new InsightScopeError('activityUnavailable');
    const storedContextId = storedContextOf(request.context);
    const row = await db.h5PContent.findUnique({
      where: { id: request.contentId },
      select: { version: true },
    });
    if (!row) throw new InsightScopeError('activityUnavailable');
    const scope = resolveInsightScope(request, {
      currentVersion: row.version,
      contextLabel: storedContextId === null ? null : await this.labelOf(request.contentId, storedContextId),
      size: groupSize,
      now,
    });
    const [metadata, params, statements, courseLearners] = await Promise.all([
      content.getMetadata(request.contentId),
      content.getParameters(request.contentId),
      readInsightStatements(db, {
        contentId: request.contentId,
        contentVersion: scope.view.contentVersion,
        storedContextId,
        start: scope.start,
        end: scope.end,
        academicYear: scope.academicYear,
      }),
      storedContextId === null ? undefined : this.deps.learnerCounts?.read(storedContextId),
    ]);
    return buildInsightReport({
      scope: scope.view,
      size: groupSize,
      mainLibrary: metadata.mainLibrary,
      params,
      statements,
      courseLearners: courseLearners?.count,
    });
  }

  /** The course label of a Canvas context from the activity's newest placement there that has one. */
  private async labelOf(contentId: string, storedContextId: string): Promise<string | null> {
    const course = parsePlatformContextKey(storedContextId);
    if (!course) return null;
    const placement = await this.deps.db.ltiPlacement.findFirst({
      where: { contentId, ...course, contextLabel: { not: null } },
      select: { contextLabel: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return placement?.contextLabel?.trim() || null;
  }
}
