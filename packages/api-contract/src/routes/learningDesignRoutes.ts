/**
 * learningDesignRoutes — the registry of the learning-design routes under `/api`: an activity's metadata,
 * course-code suggestions, the outcomes already used in a course, and the alignment planner (W3).
 *
 * Why: D-099 splits the `/api` registry by area, so each workstream adds its routes to its own table and never edits
 *      another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PED-030, PED-031
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./learningDesignSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Only people who may Edit an activity read or write its metadata (D-087); learners never get the rationale.
 * Collaborators: ./routeResponses.ts, ./learningDesignSchemaNames.ts, ../learningDesign.ts, ../planner.ts,
 *   ../apiRoutes.ts, apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';

/** The routes of this area (W3), in the order of the OpenAPI document; empty until W3 adds them. */
export const LEARNING_DESIGN_ROUTES = [] as const satisfies readonly ApiRoute[];
