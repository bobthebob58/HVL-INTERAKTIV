/**
 * routeResponses — the answers and path parameters that routes of every API area share: the error answers with
 * their codes, and the activity ID in the path.
 *
 * Why: every area registry (./coreRoutes.ts, ./studioRoutes.ts, …) documents 401, 400 and 404 the same way. One
 *      definition keeps the OpenAPI document consistent and lets workstreams add routes without copying texts.
 * Spec: DOC-012
 * Invariants:
 *   - Every error answer uses `errorBodySchema`.
 *   - `contentParams` is never checked by the server: an ID that is not a UUID is answered like an unknown
 *     activity (404, D-066).
 * Collaborators: ./coreRoutes.ts and the other area registries in this folder, ../errors.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import { z } from 'zod';
import type { ApiResponse } from '../apiRouteTypes.js';
import { errorBodySchema } from '../errors.js';

/**
 * An error answer with the shared error shape.
 * @param description - What the answer means, naming its error codes in backticks.
 * @returns The answer.
 */
export const failure = (description: string): ApiResponse => ({ description, schema: errorBodySchema });

/** 401 of every signed-in route. */
export const unauthenticated = failure(
  '`hvl:unauthenticated`, `hvl:session-expired` or `hvl:ltik-invalid`; on unsafe methods also `hvl:csrf-invalid`.',
);

/** 400 of a route whose body does not match its schema. */
export const badRequest = failure('`error.badRequest`: the body does not match the schema.');

/** 404 of a route about one activity the person may not view (D-066). */
export const unavailable = failure(
  '`hvl:activity-unavailable`: unknown (also a malformed ID), or the person may not view it (D-066).',
);

/** 403 of a route that needs Edit on an activity the person may only view. */
export const editNotAllowed = failure(
  '`hvl:edit-not-allowed`: the person may view the activity but not edit it.',
);

// WHY: the server never checks the path against this schema: an ID that is not a UUID is answered like an unknown
// activity (404), so a malformed ID reveals nothing more than an unknown one (D-066).
/** Path parameters of a route about one activity: `:contentId`. */
export const contentParams = z.strictObject({
  contentId: z
    .uuid()
    .describe('The activity ID. One that is not a UUID is answered like an unknown one: 404.'),
});
