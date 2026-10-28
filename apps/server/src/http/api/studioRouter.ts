/**
 * studioRouter — the læringsdesign studio's routes under `/api`, one router per area: the public guide and catalogue
 * (W1), patterns (W2), learning-design metadata and the planner (W3), collaboration and the content bank (W4), and the
 * pedagogisk mappe (W6).
 *
 * Why: S5's workstreams add routes in parallel; one router per area keeps each area's routes in its own file
 *      (../../learningDesign/http/), and mounting them all here, inside ./apiRouter.ts, lets the registry test compare
 *      every studio route with the contract (DOC-012, D-099).
 * Spec: DOC-012, PED-001, PED-030, PROD-001, PROD-007, MAPPE-001
 * Auth: each area states its own. The authentication middleware runs before `/api` (../../server/createApp.ts) and
 *   sets no principal for a signed-out request, so a public route (`auth: 'none'`) answers it; a signed-in route
 *   calls `requirePrincipal`, which answers 401.
 * Errors: each area lists its own; a path no area matches falls through to createApp's 404 `error.notFound`.
 * Invariants:
 *   - Every area router is mounted at the root, so its route paths are the paths below `/api`, and
 *     test/support/expressRoutes.ts can list them for the registry test.
 *   - Areas are mounted in the order of the contract's registry; every area gets the same inputs.
 *   - An area registers routes only, with its middleware on each route (a body parser such as `apiJson(limit)`, a
 *     rate limit). A path-less `router.use(…)` in an area would run for every request that passes it, including the
 *     later areas' and `/docs`, so studioRouter.test.ts refuses one.
 *   - It runs inside ./apiRouter.ts, after the S4 routes, so its answers are `Cache-Control: no-store` too.
 * Collaborators: ./apiRouter.ts (mounts it), ../../learningDesign/http/studioRouteDeps.ts,
 *   ../../learningDesign/http/studioContentRoutes.ts, ../../learningDesign/http/patternRoutes.ts,
 *   ../../learningDesign/http/learningDesignRoutes.ts, ../../learningDesign/http/collaborationRoutes.ts,
 *   ../../learningDesign/http/mappeRoutes.ts, ../../server/studioServices.ts.
 * Tests: apps/server/test/http/api/studioRouter.test.ts, apps/server/test/http/api/studioPublicRoute.int.test.ts
 */
import { Router } from 'express';
import { collaborationRoutes } from '../../learningDesign/http/collaborationRoutes.js';
import { learningDesignRoutes } from '../../learningDesign/http/learningDesignRoutes.js';
import { mappeRoutes } from '../../learningDesign/http/mappeRoutes.js';
import { patternRoutes } from '../../learningDesign/http/patternRoutes.js';
import type { StudioRouteDeps } from '../../learningDesign/http/studioRouteDeps.js';
import { studioContentRoutes } from '../../learningDesign/http/studioContentRoutes.js';

/** The area routers, in the order of the contract's registry (packages/api-contract/src/apiRoutes.ts). */
const STUDIO_AREAS = [
  studioContentRoutes,
  patternRoutes,
  learningDesignRoutes,
  collaborationRoutes,
  mappeRoutes,
] as const;

/**
 * Builds the studio's router.
 * @param deps - The database, activity facts, clock and studio services every area is built from.
 * @returns A router to mount at the root of the `/api` router, after the authentication middleware.
 * @spec DOC-012
 */
export function studioRouter(deps: StudioRouteDeps): Router {
  const router = Router();
  for (const area of STUDIO_AREAS) router.use(area(deps));
  return router;
}
