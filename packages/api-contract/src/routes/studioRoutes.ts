/**
 * studioRoutes — the registry of the public studio routes under `/api`: the guide, the phases, the references, the
 * pattern catalogue and one pattern's detail (W1).
 *
 * Why: D-099 splits the `/api` registry by area, so each workstream adds its routes to its own table and never edits
 *      another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PED-001, PED-002, PED-003, PED-011
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./studioSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Studio routes are public (`auth: 'none'`, D-089) and answer only content from `content/`, never data about
 *     people.
 * Collaborators: ./routeResponses.ts, ./studioSchemaNames.ts, ../studio.ts, ../guideNodes.ts, ../apiRoutes.ts,
 *   apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';

/** The routes of this area (W1), in the order of the OpenAPI document; empty until W1 adds them. */
export const STUDIO_ROUTES = [] as const satisfies readonly ApiRoute[];
