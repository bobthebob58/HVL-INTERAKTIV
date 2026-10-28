/**
 * mappeRoutes — the registry of the pedagogisk mappe routes under `/api`: the activity picker, the word-count
 * preview and the Markdown and PDF export (W6).
 *
 * Why: D-099 splits the `/api` registry by area, so each workstream adds its routes to its own table and never edits
 *      another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, MAPPE-001, MAPPE-003, MAPPE-004
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./mappeSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - The export answers a file (`mediaType`, D-099) that the server never stores (MAPPE-003).
 * Collaborators: ./routeResponses.ts, ./mappeSchemaNames.ts, ../mappe.ts, ../apiRoutes.ts,
 *   apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';

/** The routes of this area (W6), in the order of the OpenAPI document; empty until W6 adds them. */
export const MAPPE_ROUTES = [] as const satisfies readonly ApiRoute[];
