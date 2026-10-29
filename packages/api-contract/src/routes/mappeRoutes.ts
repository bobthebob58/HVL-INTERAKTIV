/**
 * mappeRoutes — the registry of the pedagogisk mappe routes under `/api`: the activity picker, the criteria sets, the
 * word-count preview and the Markdown and PDF export.
 *
 * Why: D-099 splits the `/api` registry by area, so each area's routes are in its own table and a change to one area
 *      never edits another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, MAPPE-001, MAPPE-003, MAPPE-004
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./mappeSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Every route is portal-only (`auth: 'portal'`, D-089, D-098): an ltik answers 401, a portal learner 403.
 *   - The export answers a file (`mediaType`, D-099) that the server never stores (MAPPE-003).
 * Collaborators: ./routeResponses.ts, ./mappeSchemaNames.ts, ../mappe.ts, ../apiRoutes.ts,
 *   apps/server/src/learningDesign/http/mappeRoutes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import { MARKDOWN_MEDIA_TYPE, PDF_MEDIA_TYPE, type ApiRoute } from '../apiRouteTypes.js';
import {
  mappeActivityListSchema,
  mappeCriteriaSetListSchema,
  mappeExportQuerySchema,
  mappePreviewSchema,
  mappeRequestSchema,
} from '../mappe.js';
import { failure, unauthenticated } from './routeResponses.js';

/** 403 of every mappe route. */
const authorsOnly = failure('`error.forbidden`: signed in on the portal without an author role.');

/** 409 of the routes that need the mappe files. */
const notReady = failure(
  '`hvl:mappe-not-ready`: the mappe’s template and criteria files are not in the content yet (D-094).',
);

/** 400 of the routes that make a portfolio. */
const badMappeRequest = failure(
  '`error.badRequest`: the body (or the query) does not match the schema; `hvl:mappe-too-many`: more than 50 ' +
    'activities; `hvl:criteria-set-unknown`: the criteria set is not in the content files.',
);

/** 404 of the routes that make a portfolio. */
const activityUnavailable = failure(
  '`hvl:activity-unavailable`: an activity is unknown, or is not one the author owns or co-authors (D-066).',
);

/** The routes of this area, in the order of the OpenAPI document. */
export const MAPPE_ROUTES = [
  {
    operationId: 'getMappeActivities',
    method: 'get',
    path: '/mappe/activities',
    auth: 'portal',
    summary:
      'The activities the author owns or co-authors, to pick for a pedagogisk mappe, with the course, phase and ' +
      'date the page filters by; newest change first (MAPPE-001).',
    responses: {
      200: { description: 'The activities.', schema: mappeActivityListSchema },
      401: unauthenticated,
      403: authorsOnly,
    },
  },
  {
    operationId: 'getMappeCriteriaSets',
    method: 'get',
    path: '/mappe/criteria-sets',
    auth: 'portal',
    summary:
      'The criteria sets of the content files, with their limits and the default set (MAPPE-002, D-094).',
    responses: {
      200: { description: 'The criteria sets.', schema: mappeCriteriaSetListSchema },
      401: unauthenticated,
      403: authorsOnly,
      409: notReady,
    },
  },
  {
    operationId: 'previewMappe',
    method: 'post',
    path: '/mappe/preview',
    auth: 'portal',
    summary:
      'Makes the portfolio in memory and answers its Del 1 word count (without the reader’s guide and the ' +
      'references) and attachment count against the set’s limits; over a limit is a flag, never a refusal ' +
      '(MAPPE-002, D-094).',
    body: mappeRequestSchema,
    responses: {
      200: { description: 'The counts and limits.', schema: mappePreviewSchema },
      400: badMappeRequest,
      401: unauthenticated,
      403: authorsOnly,
      404: activityUnavailable,
      409: notReady,
    },
  },
  {
    operationId: 'exportMappe',
    method: 'post',
    path: '/mappe/export',
    auth: 'portal',
    summary:
      'Makes the portfolio and answers it as a Markdown or tagged PDF file (`Content-Disposition: attachment`, ' +
      '`Cache-Control: no-store`); it is never stored on the server (MAPPE-001, MAPPE-003, MAPPE-004).',
    query: mappeExportQuerySchema,
    body: mappeRequestSchema,
    responses: {
      200: { description: 'The portfolio file.', mediaType: [MARKDOWN_MEDIA_TYPE, PDF_MEDIA_TYPE] },
      400: badMappeRequest,
      401: unauthenticated,
      403: authorsOnly,
      404: activityUnavailable,
      409: notReady,
      503: failure(
        '`hvl:pdf-busy` (every PDF slot in use, or the person already makes one; with `Retry-After`) or ' +
          '`hvl:pdf-unavailable` (no browser, or over the time limit); the Markdown export still works (D-096).',
      ),
    },
  },
] as const satisfies readonly ApiRoute[];
