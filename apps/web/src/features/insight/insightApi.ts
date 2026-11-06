/**
 * insightApi — typed calls of the insight routes: one activity's view for a period, context and content version,
 * the contexts it can be viewed for, and the same view as an aggregated CSV file.
 *
 * Why: the Innsikt tab (INS-001…INS-010) reads one already suppressed answer from the server, which also decides who
 *      may see which context (INS-007, D-106); these functions only carry the requests. In Canvas the context is the
 *      launch's and is never sent, so the server alone fixes it (D-106). The CSV is fetched with the page's
 *      credential and handed to the browser to save, as a plain link cannot carry the Bearer ltik (LTI-003).
 * Spec: INS-001, INS-007, INS-009, PROD-013, LTI-003
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - The activity ID is percent-encoded into the path; the query holds only the period, the context key and the
 *     version, each left out when not chosen, so the server applies its defaults (7 days, current version).
 *   - Every path of the insight API is built in `insightPath`, the one place to change if the routes move.
 *   - PRIVACY: no request names a learner; the answers carry aggregates only.
 * Collaborators: ../../api/apiRequest.ts, ./insightReportShape.ts, ./useInsightView.ts, ./InsightCsvDownload.tsx,
 *   the insight routes (apps/server/src/insight/http, the API workstream).
 * Tests: apps/web/test/features/insight/InsightPanel.test.tsx, apps/web/test/features/insight/InsightCsv.test.tsx
 */
import type { InsightQuery } from '@hvl-interaktiv/api-contract';
import {
  apiFileRequest,
  apiRequest,
  type ApiAuth,
  type ApiFileResult,
  type ApiResult,
} from '../../api/apiRequest';
import type { InsightContextsResponse, InsightReport } from './insightReportShape';

/** The media type of the CSV export (INS-009). */
export const INSIGHT_CSV_TYPE = 'text/csv';

/**
 * The path of an insight route of one activity.
 * @param contentId - The activity.
 * @param route - `''` for the view, `/contexts` for its contexts, `/export` for the CSV.
 * @param query - The view's period, context and version; left out of the path when empty.
 * @returns A same-origin path, e.g. `/api/content/<id>/insight?period=14d`.
 */
export function insightPath(
  contentId: string,
  route: '' | '/contexts' | '/export',
  query: InsightQuery = {},
): string {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.context) params.set('context', query.context);
  if (query.version) params.set('version', query.version);
  const search = params.toString();
  return `/api/content/${encodeURIComponent(contentId)}/insight${route}${search ? `?${search}` : ''}`;
}

/**
 * One activity's insight for a period, context and version.
 * @param contentId - The activity.
 * @param query - Period, context (portal only) and version; the server's defaults for what is left out.
 * @param auth - The credential.
 * @returns The report, or 403 (not the person's to see), 404 (unavailable) and 400 (a version or context it lacks).
 */
export const getInsight = (
  contentId: string,
  query: InsightQuery,
  auth: ApiAuth,
): Promise<ApiResult<InsightReport>> => apiRequest<InsightReport>(insightPath(contentId, '', query), auth);

/**
 * The contexts the person may view an activity's insight for (portal only; in Canvas the launch fixes it).
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The portal first, then each Canvas course with its label.
 */
export const getInsightContexts = (
  contentId: string,
  auth: ApiAuth,
): Promise<ApiResult<InsightContextsResponse>> =>
  apiRequest<InsightContextsResponse>(insightPath(contentId, '/contexts'), auth);

/**
 * The view as an aggregated CSV file, with the same suppression (INS-009, INS-006).
 * @param contentId - The activity.
 * @param query - The same query as the view on screen.
 * @param auth - The credential.
 * @returns The file and the name the server suggests, or the refusal.
 */
export const exportInsightCsv = (
  contentId: string,
  query: InsightQuery,
  auth: ApiAuth,
): Promise<ApiFileResult> =>
  apiFileRequest(insightPath(contentId, '/export', query), auth, { accept: INSIGHT_CSV_TYPE });
