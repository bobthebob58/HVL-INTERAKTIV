/**
 * coreRoutes — the registry of the S3 and S4 routes under `/api`: who is signed in, the person's activities,
 * findings, publishing, sharing and the document itself.
 *
 * Why: DOC-012 asks for self-describing HTTP APIs. D-099 splits the registry by area so that parallel work never
 *      edits the same table; this is the area of the routes that existed before S5, unchanged in content and order.
 * Spec: DOC-012, PROD-003, PROD-011, PROD-006
 * Invariants:
 *   - `path` is below `/api`, in Express form (`/content/:contentId`); every `:name` has a schema in `params`. The
 *     server does not answer a path that misses it with 400: a malformed `contentId` is 404 like an unknown one
 *     (D-066), and a notice ID outside the allowlist is 404 as well.
 *   - Every 400 answer describes the body only, because no path parameter leads to one.
 *   - Every schema a route names is listed in ./coreSchemaNames.ts.
 *   - Error answers use `errorBodySchema`; only publish's 409 can carry findings.
 * Collaborators: ./routeResponses.ts, ./coreSchemaNames.ts, ../apiRoutes.ts, ../me.ts, ../content.ts,
 *   ../findings.ts, ../publishing.ts, ../sharing.ts, ../errors.ts, apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import { z } from 'zod';
import { openApiDocumentSchema, type ApiRoute } from '../apiRouteTypes.js';
import { contentDetailSchema, contentListSchema } from '../content.js';
import { publishConflictBodySchema } from '../errors.js';
import { findingsResponseSchema } from '../findings.js';
import { meSchema, noticeDismissalRequestSchema, noticeIdSchema } from '../me.js';
import {
  publishRequestSchema,
  publishResponseSchema,
  unpublishRequestSchema,
  unpublishResponseSchema,
} from '../publishing.js';
import { sharingRequestSchema, sharingResponseSchema } from '../sharing.js';
import {
  badRequest,
  contentParams,
  editNotAllowed,
  failure,
  unauthenticated,
  unavailable,
} from './routeResponses.js';

/** The routes that existed before S5, in the order of the OpenAPI document. */
export const CORE_ROUTES = [
  {
    operationId: 'getMe',
    method: 'get',
    path: '/me',
    auth: 'either',
    summary: 'Who is signed in: mode, language, roles and dismissed notices; never a name, e-mail or ID.',
    responses: { 200: { description: 'The signed-in person.', schema: meSchema }, 401: unauthenticated },
  },
  {
    operationId: 'dismissNotice',
    method: 'put',
    path: '/me/notices/:noticeId',
    auth: 'either',
    summary: 'Remembers that the person dismissed a version of a notice (PROD-011).',
    params: z.strictObject({ noticeId: noticeIdSchema }),
    body: noticeDismissalRequestSchema,
    responses: {
      204: { description: 'Stored; replaces an earlier dismissal of the same notice.' },
      400: failure(
        '`error.badRequest`: the body does not match the schema, or `version` is newer than the current version.',
      ),
      401: unauthenticated,
      403: failure('`error.forbidden`: learners never see these notices.'),
      404: failure('`error.notFound`: the notice ID is not in the allowlist.'),
    },
  },
  {
    operationId: 'listContent',
    method: 'get',
    path: '/content',
    auth: 'either',
    summary: "The person's own and co-authored activities, newest change first.",
    responses: { 200: { description: 'The activities.', schema: contentListSchema }, 401: unauthenticated },
  },
  {
    operationId: 'getContent',
    method: 'get',
    path: '/content/:contentId',
    auth: 'either',
    summary: 'One activity the person may view, and whether they may edit and publish it.',
    params: contentParams,
    responses: {
      200: { description: 'The activity.', schema: contentDetailSchema },
      401: unauthenticated,
      404: unavailable,
    },
  },
  {
    operationId: 'getFindings',
    method: 'get',
    path: '/content/:contentId/findings',
    auth: 'either',
    summary: 'Validates the stored activity and lists the findings with their acknowledgements (PROD-003).',
    params: contentParams,
    responses: {
      200: { description: 'The findings, in the person’s language.', schema: findingsResponseSchema },
      401: unauthenticated,
      403: editNotAllowed,
      404: unavailable,
    },
  },
  {
    operationId: 'publishContent',
    method: 'post',
    path: '/content/:contentId/publish',
    auth: 'either',
    summary: 'Publishes the stored activity when every error is fixed or acknowledged (PROD-003, UD-022).',
    params: contentParams,
    body: publishRequestSchema,
    responses: {
      200: { description: 'Published.', schema: publishResponseSchema },
      400: failure('`error.badRequest`, or `hvl:acknowledgement-invalid`: a reason names no current error.'),
      401: unauthenticated,
      403: editNotAllowed,
      404: unavailable,
      409: {
        description:
          '`hvl:publish-blocked` with findings, or `hvl:content-changed` (changed since `updatedAt`, or a save of the ' +
          'activity is still running after 30 s).',
        schema: publishConflictBodySchema,
      },
    },
  },
  {
    operationId: 'unpublishContent',
    method: 'post',
    path: '/content/:contentId/unpublish',
    auth: 'either',
    summary: 'Returns a published activity to draft.',
    params: contentParams,
    body: unpublishRequestSchema,
    responses: {
      200: { description: 'A draft again.', schema: unpublishResponseSchema },
      400: badRequest,
      401: unauthenticated,
      403: editNotAllowed,
      404: unavailable,
      409: failure('`hvl:content-changed`: the activity changed since `updatedAt`.'),
    },
  },
  {
    operationId: 'changeSharing',
    method: 'patch',
    path: '/content/:contentId/sharing',
    auth: 'either',
    summary: 'Changes who can find the activity outside Canvas (PROD-006); never its status.',
    params: contentParams,
    body: sharingRequestSchema,
    responses: {
      200: { description: 'Changed and audited.', schema: sharingResponseSchema },
      400: badRequest,
      401: unauthenticated,
      403: failure('`hvl:sharing-not-allowed`: a student author may keep activities private only (D-059).'),
      404: failure(
        '`hvl:activity-unavailable`: unknown (also a malformed ID), or the person may not edit it (D-066).',
      ),
      409: failure('`hvl:sharing-changed`: someone else changed the visibility in the meantime.'),
    },
  },
  {
    operationId: 'getApiDocs',
    method: 'get',
    path: '/docs',
    auth: 'none',
    summary: 'This OpenAPI document; served only when NODE_ENV is not production (D-077).',
    responses: { 200: { description: 'The OpenAPI 3.1 document.', schema: openApiDocumentSchema } },
  },
] as const satisfies readonly ApiRoute[];
