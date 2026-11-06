/**
 * insightView — turns an admitted request into one insight view: reads the query, fixes the context for the reader,
 * and asks the insight core for the report, answering a scope it cannot cover with the API's error.
 *
 * Why: the view and the CSV export (INS-009) cover exactly the same view, so both routes build it here: one activity,
 *      one content version (the current one by default, PROD-013), one context (the portal by default; in Canvas the
 *      launch's, D-106) and one fixed period (7 days by default, D-106).
 * Spec: INS-001, INS-007, INS-009, PROD-013
 * Invariants:
 *   - The query is the contract's `insightQuerySchema`: `period`, `context` and `version` only, each once; anything
 *     else is 400 `error.badRequest`, so no free date reaches the core (`SPEC-DEVIATION: D-106`).
 *   - The context is decided by ./insightAccess.ts before the core runs; the core's own checks stay as a second line.
 *   - A scope the core refuses is answered as the contract says: an activity it cannot find is 404
 *     `hvl:activity-unavailable` (D-066), a version or context it cannot cover 400 `error.badRequest`.
 * Collaborators: ./insightAccess.ts, ../InsightService.ts, ../scope/insightScope.ts, ../../http/api/apiBodies.ts,
 *   ./insightRoutes.ts.
 * Tests: apps/server/test/insight/http/insightRoutes.int.test.ts
 */
import { insightQuerySchema } from '@hvl-interaktiv/api-contract';
import type { Request } from 'express';
import { parseBody } from '../../http/api/apiBodies.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';
import type { InsightService } from '../InsightService.js';
import type { InsightReport } from '../insightReport.js';
import { InsightScopeError } from '../scope/insightScope.js';
import { viewContext, type InsightAccess } from './insightAccess.js';

/** The parts of the insight core a view reads. */
export type InsightViews = Pick<InsightService, 'forActivity' | 'contexts'>;

/**
 * Builds the view a request asks for.
 * @param req - The request; only its query is read.
 * @param access - The admitted activity and reader.
 * @param insight - The insight core.
 * @returns The report, already suppressed (INS-006).
 * @throws HttpError 400 `error.badRequest` (query, version or context), 403 `error.forbidden` (in Canvas, another
 *   context) or 404 `hvl:activity-unavailable`.
 * @spec INS-001
 */
export async function insightViewOf(
  req: Request,
  access: InsightAccess,
  insight: InsightViews,
): Promise<InsightReport> {
  const query = parseBody(insightQuerySchema, { ...req.query });
  const context = await viewContext(access.reader, query.context, () => insight.contexts(access.contentId));
  try {
    return await insight.forActivity({
      contentId: access.contentId,
      context,
      period: query.period,
      version: query.version === undefined ? undefined : Number(query.version),
    });
  } catch (error) {
    if (!(error instanceof InsightScopeError)) throw error;
    // WHY: the activity was found by the access check; it can only vanish in between (deleted meanwhile).
    if (error.reason === 'activityUnavailable') throw authError('hvl:activity-unavailable');
    throw new HttpError(400, 'error.badRequest');
  }
}
