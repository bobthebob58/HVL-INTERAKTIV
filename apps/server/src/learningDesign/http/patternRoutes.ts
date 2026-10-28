/**
 * patternRoutes — the pattern routes under `/api` (workstream W2): creating an activity from a pattern, with its
 * learning-design metadata, in one request.
 *
 * Why: `PROD-001` opens the editor on a pedagogically sound skeleton, and D-085 builds that skeleton on the server so
 *      the metadata never travels through the browser and a test can create every pattern. This is W2's one router,
 *      mounted by the studio router; it registers no routes until W2 adds them.
 * Spec: PROD-001, PED-010, PED-011
 * Auth: portal — a signed-in portal author (Feide session) with the CSRF token; an LTI launch is refused (the Canvas
 *   side waits for S6, D-098). Every route starts with `requirePortalAuthor` (./studioPrincipal.ts).
 * Errors: W2 lists its own as it adds routes; D-085 names 400 `hvl:pattern-choice-invalid`, 404 `error.notFound` for
 *   an unknown pattern and 409 `hvl:pattern-unavailable` when a library the skeleton needs is not installed.
 * Invariants:
 *   - Saves only through `HvlH5PEditor`'s save path (`studio.patternCreator`), so every editor check runs (D-085).
 *   - Every route here is listed in packages/api-contract/src/routes/patternRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../../server/studioServices.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/studioRouter.test.ts
 */
import { Router } from 'express';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the pattern routes.
 * @param _deps - The studio's route inputs; this area uses `studio.patternCreator` and `studio.content`.
 * @returns A router to mount at the root of the studio router.
 * @spec PROD-001
 */
export function patternRoutes(_deps: StudioRouteDeps): Router {
  return Router();
}
