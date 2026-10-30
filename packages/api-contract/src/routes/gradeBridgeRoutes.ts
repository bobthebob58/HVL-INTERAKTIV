/**
 * gradeBridgeRoutes — the registry of the grade-bridge routes under `/api`: the xAPI batch the player's bridge posts,
 * and the grade-sync status and retry that authors use.
 *
 * Why: D-099 splits the `/api` registry by area. The xAPI route is LTI-011's, shaped by D-115 (202 with no detail per
 *      item; 400, 403 and 413 refuse a whole batch, which the bridge then drops; 429 is retried). The status and retry
 *      routes are LTI-012's acceptance (D-104); who may use them follows D-106.
 * Spec: DOC-012, LTI-011, LTI-012
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, and every schema a route names
 *     is listed in ./gradeBridgeSchemaNames.ts. Every route documents 401 and works with a portal session (with the
 *     CSRF token on `POST`) or an ltik (`auth: 'either'`).
 *   - Not yet in ../apiRoutes.ts: apps/server/test/http/api/apiDocs.int.test.ts requires the registry and the mounted
 *     routes to agree, so step 3 adds `GRADE_BRIDGE_ROUTES` there in the change that mounts them.
 *   - PRIVACY: a non-learner's batch is answered 202 like a learner's and stores nothing (D-102), so the answer never
 *     tells whose statements are kept.
 * Collaborators: ./routeResponses.ts, ./collaborationResponses.ts (`rateLimited`), ./gradeBridgeSchemaNames.ts,
 *   ../xapi.ts, ../gradeSync.ts, apps/server (the routes, step 3).
 * Tests: packages/api-contract/test/gradeBridgeRoutes.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';
import {
  gradeSyncRetryRequestSchema,
  gradeSyncRetryResponseSchema,
  gradeSyncStatusResponseSchema,
} from '../gradeSync.js';
import { xapiBatchSchema } from '../xapi.js';
import { rateLimited } from './collaborationResponses.js';
import { contentParams, failure, unauthenticated, unavailable } from './routeResponses.js';

/** 403 of the grade-sync routes. */
const gradeSyncRefused = failure(
  '`error.forbidden`: neither an owner or co-author of the activity nor a Canvas author of a course it is placed ' +
    'in (D-106); learners never.',
);

/** The routes of this area, in the order of the OpenAPI document. */
export const GRADE_BRIDGE_ROUTES = [
  {
    operationId: 'postXapiBatch',
    method: 'post',
    path: '/h5p/xapi',
    auth: 'either',
    summary:
      'The player bridge’s batch of xAPI statements about one activity: each valid item from a learner is stored ' +
      'once under its statement ID (DATA-012), and a gradable root result in Canvas queues a score (LTI-011, D-115).',
    body: xapiBatchSchema,
    responses: {
      202: {
        description:
          'Accepted, with an empty body and no detail per item: invalid items and those the server does not store ' +
          '(interacted, progressed, replays) are discarded on their own, and a batch from anyone but a learner ' +
          'stores nothing (D-102, D-115).',
      },
      400: failure(
        '`error.badRequest`: not a batch (no activity or version, no items or more than 50), or a content ' +
          'version above the activity’s current one.',
      ),
      401: unauthenticated,
      403: failure(
        '`error.forbidden`: the activity is unknown or the person may not view it; in Canvas, any activity but ' +
          'the launched one. The same answer for each, so it tells nothing more (D-066).',
      ),
      413: failure('`error.tooLarge`: the body is over 64 KiB (D-115).'),
      429: rateLimited(
        'over 120 statements in a minute from this learner about this activity (LTI-011); nothing from the batch ' +
          'is stored',
      ),
    },
  },
  {
    operationId: 'getGradeSyncStatus',
    method: 'get',
    path: '/content/:contentId/grade-sync',
    auth: 'either',
    summary:
      'The grade sync of each placement the person may see: jobs sent, pending, failed and orphaned, not ' +
      'k-suppressed (spec 05 §3); the view labels the scores formative (LTI-012, D-104, D-105).',
    params: contentParams,
    responses: {
      200: { description: 'The placements and their counts.', schema: gradeSyncStatusResponseSchema },
      401: unauthenticated,
      403: gradeSyncRefused,
      404: unavailable,
    },
  },
  {
    operationId: 'retryGradeSync',
    method: 'post',
    path: '/content/:contentId/grade-sync/retry',
    auth: 'either',
    summary:
      'Sends a placement’s failed jobs again: each becomes pending, except one whose encrypted Canvas user ID is ' +
      'gone; orphaned jobs are never retried (LTI-012, D-104).',
    params: contentParams,
    body: gradeSyncRetryRequestSchema,
    responses: {
      200: { description: 'How many jobs are pending again.', schema: gradeSyncRetryResponseSchema },
      400: failure('`error.badRequest`: the body does not match the schema.'),
      401: unauthenticated,
      403: gradeSyncRefused,
      404: failure(
        '`hvl:activity-unavailable`: the activity is unknown or not viewable (D-066), or the placement is not ' +
          'one of its placements that the person may see.',
      ),
    },
  },
] as const satisfies readonly ApiRoute[];
