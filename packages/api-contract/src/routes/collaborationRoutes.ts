/**
 * collaborationRoutes — the registry of the collaboration routes under `/api`: people search, co-authors, the
 * content bank and duplicating (W4).
 *
 * Why: D-099 splits the `/api` registry by area, so each workstream adds its routes to its own table and never edits
 *      another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PROD-007
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./collaborationSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Removing a co-author or a bank listing is a `DELETE` (D-099); people search never logs its query (D-090).
 * Collaborators: ./routeResponses.ts, ./collaborationSchemaNames.ts, ../collaboration.ts, ../apiRoutes.ts,
 *   apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';

/** The routes of this area (W4), in the order of the OpenAPI document; empty until W4 adds them. */
export const COLLABORATION_ROUTES = [] as const satisfies readonly ApiRoute[];
