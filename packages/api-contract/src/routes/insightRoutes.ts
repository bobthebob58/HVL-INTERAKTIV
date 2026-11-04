/**
 * insightRoutes — the registry of the insight routes under `/api`: one activity's view, the contexts it can be viewed
 * for, the same view as an aggregated CSV file, and its validator findings.
 *
 * Why: D-099 splits the `/api` registry by area. Insight is the Innsikt tab on the activity page and in the Canvas
 *      view `/app/play` (D-101); who may see which context is INS-007 as D-106 amends it; the CSV is INS-009 with the
 *      same suppression; the findings are INS-010 for every insight reader.
 * Spec: DOC-012, INS-001, INS-006, INS-007, INS-009, INS-010, PROD-010
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./insightSchemaNames.ts.
 *   - Every route is `auth: 'either'` (a portal session or an ltik; GET needs no CSRF token) and documents 401, 403,
 *     404 and 429. No route takes a learner or returns a per-learner row (INS-006).
 *   - The answers to 403 and 404 follow D-066: an activity the person may not view is 404 like an unknown one.
 * Collaborators: ./routeResponses.ts, ./collaborationResponses.ts (`rateLimited`), ./insightSchemaNames.ts,
 *   ../insight.ts, ../insightReport.ts, ../insightContextList.ts, ../insightFindings.ts, ../apiRoutes.ts,
 *   apps/server/src/insight/http/insightRoutes.ts (the routes).
 * Tests: packages/api-contract/test/insightRoutes.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import { CSV_MEDIA_TYPE, type ApiRoute } from '../apiRouteTypes.js';
import { insightQuerySchema } from '../insight.js';
import { insightContextsResponseSchema } from '../insightContextList.js';
import { insightFindingsResponseSchema } from '../insightFindings.js';
import { insightReportSchema } from '../insightReport.js';
import { rateLimited } from './collaborationResponses.js';
import { contentParams, failure, unauthenticated, unavailable } from './routeResponses.js';

/** 403 of every insight route. */
const insightRefused = failure(
  '`error.forbidden`: a learner; an admin, or a colleague who may only view the activity, who neither owns nor ' +
    'co-authors it; a Canvas author whose launch’s course the activity is not placed in; or, in Canvas, a context ' +
    'other than the launch’s (INS-007, D-106).',
);

/** 400 of the routes that take the view's query. */
const badQuery = failure(
  '`error.badRequest`: the query does not match the schema, the version is above the activity’s current one, or ' +
    'the context is not one the activity has (PROD-013, D-103).',
);

/** 429 of every insight route. */
const tooMany = rateLimited('over 60 insight requests in a minute from this person');

/** The routes of this area, in the order of the OpenAPI document. */
export const INSIGHT_ROUTES = [
  {
    operationId: 'getInsight',
    method: 'get',
    path: '/content/:contentId/insight',
    auth: 'either',
    summary:
      'One view of an activity’s insight («Før samlinga»): one content version (the current one by default), one ' +
      'context (the portal by default; in Canvas always the launch’s course) and one fixed period (7 days by ' +
      'default), every value about fewer than k learners suppressed. Each view is audited as `insight.view` ' +
      '(INS-001…INS-007, D-106).',
    params: contentParams,
    query: insightQuerySchema,
    responses: {
      200: { description: 'The view, already suppressed (INS-006).', schema: insightReportSchema },
      400: badQuery,
      401: unauthenticated,
      403: insightRefused,
      404: unavailable,
      429: tooMany,
    },
  },
  {
    operationId: 'getInsightContexts',
    method: 'get',
    path: '/content/:contentId/insight/contexts',
    auth: 'either',
    summary:
      'The contexts the person may view the activity’s insight for: the portal and each Canvas course it is ' +
      'placed in, or in Canvas the launch’s course alone; labels only, no counts (INS-007, D-106).',
    params: contentParams,
    responses: {
      200: { description: 'The contexts.', schema: insightContextsResponseSchema },
      401: unauthenticated,
      403: insightRefused,
      404: unavailable,
      429: tooMany,
    },
  },
  {
    operationId: 'exportInsightCsv',
    method: 'get',
    path: '/content/:contentId/insight/export',
    auth: 'either',
    summary:
      'The same view as an aggregated CSV file (`Content-Disposition: attachment`, a file name without personal ' +
      'data, `Cache-Control: no-store`): the formative-use note, the scope, then one row per value, a suppressed ' +
      'value written «< k». Audited as `insight.export` (INS-009, INS-006, D-105).',
    params: contentParams,
    query: insightQuerySchema,
    responses: {
      200: { description: 'The CSV file, UTF-8 with a byte-order mark.', mediaType: CSV_MEDIA_TYPE },
      400: badQuery,
      401: unauthenticated,
      403: insightRefused,
      404: unavailable,
      429: tooMany,
    },
  },
  {
    operationId: 'getInsightFindings',
    method: 'get',
    path: '/content/:contentId/insight/findings',
    auth: 'either',
    summary:
      'The validator’s current findings for the stored activity and the acknowledgements that cover them, for ' +
      'everyone who may see its insight; an acknowledgement’s reason only for those who may edit (INS-010, UD-022).',
    params: contentParams,
    responses: {
      200: { description: 'The findings, in the person’s language.', schema: insightFindingsResponseSchema },
      401: unauthenticated,
      403: insightRefused,
      404: unavailable,
      429: tooMany,
    },
  },
] as const satisfies readonly ApiRoute[];
