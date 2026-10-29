/**
 * patternRoutes — the registry of the route that creates an activity from a pattern (W2).
 *
 * Why: D-099 splits the `/api` registry by area, so each workstream adds its routes to its own table and never edits
 *      another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PROD-001, PED-010
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./patternSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Creating needs a signed-in portal author (`auth: 'portal'`, CSRF token) and answers 409
 *     `hvl:pattern-unavailable` for a pattern whose libraries are not installed (D-085).
 * Collaborators: ./routeResponses.ts, ./patternSchemaNames.ts, ../patterns.ts, ../apiRoutes.ts,
 *   apps/server/src/learningDesign/http/patternRoutes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';
import {
  patternActivityRequestSchema,
  patternActivityResponseSchema,
  patternParamsSchema,
} from '../patterns.js';
import { failure, unauthenticated } from './routeResponses.js';

/** The routes of this area (W2), in the order of the OpenAPI document. */
export const PATTERN_ROUTES = [
  {
    operationId: 'createActivityFromPattern',
    method: 'post',
    path: '/patterns/:patternId/activities',
    auth: 'portal',
    summary:
      'Creates a private draft from a pattern in the chosen language, with its phase, pattern, course code and ' +
      'student minutes as learning-design metadata (PROD-001, D-085).',
    params: patternParamsSchema,
    body: patternActivityRequestSchema,
    responses: {
      201: { description: 'Created; open it on the Rediger tab.', schema: patternActivityResponseSchema },
      400: failure(
        '`error.badRequest`: the body does not match the schema; or `hvl:pattern-choice-invalid`: a phase or ' +
          'content type the pattern does not offer, or no content type for a pattern with two.',
      ),
      401: unauthenticated,
      403: failure(
        '`error.forbidden`: signed in on the portal without an author role; or the editor refuses the save.',
      ),
      404: failure('`error.notFound`: there is no pattern with this ID.'),
      409: failure('`hvl:pattern-unavailable`: a content type the pattern needs is not installed (D-085).'),
    },
  },
] as const satisfies readonly ApiRoute[];
