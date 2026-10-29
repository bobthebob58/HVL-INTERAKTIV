/**
 * learningDesignRoutes — the registry of the learning-design routes under `/api`: an activity's metadata,
 * course-code suggestions, the outcomes already used in a course, and the alignment planner.
 *
 * Why: D-099 splits the `/api` registry by area, so each area's routes are in its own table and a change to one area
 *      never edits another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PED-030, PED-031
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./learningDesignSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Only people who may Edit an activity read or write its metadata (D-087); learners never get the rationale.
 *   - Every route is portal-only (`auth: 'portal'`, D-089, D-098): an ltik answers 401, a portal learner 403.
 * Collaborators: ./routeResponses.ts, ./learningDesignSchemaNames.ts, ../learningDesign.ts, ../planner.ts,
 *   ../apiRoutes.ts, apps/server/src/learningDesign/http/learningDesignRoutes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';
import {
  courseCodeQuerySchema,
  courseCodeSuggestionsSchema,
  courseOutcomesSchema,
  learningDesignSchema,
  learningDesignUpdateSchema,
} from '../learningDesign.js';
import { plannerSchema } from '../planner.js';
import { badRequest, contentParams, failure, unauthenticated, unavailable } from './routeResponses.js';

/** 403 of the routes about one activity's metadata. */
const metadataForbidden = failure(
  '`error.forbidden`: signed in on the portal without an author role; or `hvl:edit-not-allowed`: the person may ' +
    'view the activity but not edit it (D-087).',
);

/** 403 of the routes about the author's own courses. */
const authorsOnly = failure('`error.forbidden`: signed in on the portal without an author role.');

/** 400 of the routes that take a course code in the query. */
const badCourseCode = failure(
  '`error.badRequest`: the query has no valid course code (after D-087’s normalisation), or other parameters.',
);

/** The routes of this area, in the order of the OpenAPI document. */
export const LEARNING_DESIGN_ROUTES = [
  {
    operationId: 'getLearningDesign',
    method: 'get',
    path: '/content/:contentId/learning-design',
    auth: 'portal',
    summary:
      'An activity’s learning-design metadata, for people who may edit it (PED-030, D-087); `updatedAt` is null ' +
      'while none has been stored.',
    params: contentParams,
    responses: {
      200: { description: 'The metadata.', schema: learningDesignSchema },
      401: unauthenticated,
      403: metadataForbidden,
      404: unavailable,
    },
  },
  {
    operationId: 'replaceLearningDesign',
    method: 'put',
    path: '/content/:contentId/learning-design',
    auth: 'portal',
    summary:
      'Replaces an activity’s learning-design metadata (a left-out field is cleared), if it is still as of the ' +
      '`updatedAt` sent; the stored `patternId` is kept (PED-030, D-087).',
    params: contentParams,
    body: learningDesignUpdateSchema,
    responses: {
      200: { description: 'Stored; the metadata with its new `updatedAt`.', schema: learningDesignSchema },
      400: badRequest,
      401: unauthenticated,
      403: metadataForbidden,
      404: unavailable,
      409: failure(
        '`hvl:learning-design-conflict`: the metadata changed since the `updatedAt` sent (null: one was stored ' +
          'meanwhile); nothing was changed.',
      ),
    },
  },
  {
    operationId: 'getCourseCodeSuggestions',
    method: 'get',
    path: '/learning-design/course-codes',
    auth: 'portal',
    summary:
      'The course codes of the author’s own and co-authored activities, and the course labels of their Canvas ' +
      'placements that are course codes (PED-030, D-087, D-088).',
    responses: {
      200: { description: 'The course codes.', schema: courseCodeSuggestionsSchema },
      401: unauthenticated,
      403: authorsOnly,
    },
  },
  {
    operationId: 'getCourseOutcomes',
    method: 'get',
    path: '/learning-design/outcomes',
    auth: 'portal',
    summary:
      'The distinct learning outcomes the author’s own and co-authored activities already use for one course ' +
      'code, by category and then text (PED-030, D-087).',
    query: courseCodeQuerySchema,
    responses: {
      200: { description: 'The outcomes.', schema: courseOutcomesSchema },
      400: badCourseCode,
      401: unauthenticated,
      403: authorsOnly,
    },
  },
  {
    operationId: 'getPlanner',
    method: 'get',
    path: '/learning-design/planner',
    auth: 'portal',
    summary:
      'The alignment planner for one course code: the author’s own and co-authored activities (drafts included) as ' +
      'outcomes × phases, with the gaps and the untagged activities (PED-031, D-088).',
    query: courseCodeQuerySchema,
    responses: {
      200: { description: 'The planner.', schema: plannerSchema },
      400: badCourseCode,
      401: unauthenticated,
      403: authorsOnly,
    },
  },
] as const satisfies readonly ApiRoute[];
