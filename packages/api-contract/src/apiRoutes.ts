/**
 * apiRoutes — the registry of every route under `/api`: the area registries in ./routes/, concatenated in the order
 * of the OpenAPI document.
 *
 * Why: DOC-012 asks for self-describing HTTP APIs. One list drives the OpenAPI document (./openApi.ts), and a server
 *      test compares it with the routes Express really mounts, so a route cannot be added without being described.
 *      D-099 splits the list by area so that parallel work adds routes in separate files.
 * Spec: DOC-012
 * Invariants:
 *   - The routes before S5 come first, unchanged in content and order (./routes/coreRoutes.ts).
 *   - Operation IDs and method-and-path pairs are unique across all areas (a test checks it).
 *   - An area joins this list in the change that mounts its routes, since the server test compares the two: the S6
 *     grade-bridge routes (./routes/gradeBridgeRoutes.ts) are described, and join when step 3 mounts them.
 * Collaborators: ./routes/*Routes.ts, ./apiRouteTypes.ts, ./openApi.ts, apps/server/src/http/api/apiRouter.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from './apiRouteTypes.js';
import { COLLABORATION_ROUTES } from './routes/collaborationRoutes.js';
import { CORE_ROUTES } from './routes/coreRoutes.js';
import { LEARNING_DESIGN_ROUTES } from './routes/learningDesignRoutes.js';
import { MAPPE_ROUTES } from './routes/mappeRoutes.js';
import { PATTERN_ROUTES } from './routes/patternRoutes.js';
import { STUDIO_ROUTES } from './routes/studioRoutes.js';

/** Every route under `/api`, in the order of the OpenAPI document. */
export const API_ROUTES = [
  ...CORE_ROUTES,
  ...STUDIO_ROUTES,
  ...PATTERN_ROUTES,
  ...LEARNING_DESIGN_ROUTES,
  ...COLLABORATION_ROUTES,
  ...MAPPE_ROUTES,
] as const satisfies readonly ApiRoute[];
