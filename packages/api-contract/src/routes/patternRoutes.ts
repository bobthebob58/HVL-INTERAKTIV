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
 *   apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';

/** The routes of this area (W2), in the order of the OpenAPI document; empty until W2 adds them. */
export const PATTERN_ROUTES = [] as const satisfies readonly ApiRoute[];
