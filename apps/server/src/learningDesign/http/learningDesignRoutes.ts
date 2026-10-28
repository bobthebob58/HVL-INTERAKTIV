/**
 * learningDesignRoutes — the learning-design routes under `/api` (workstream W3): an activity's metadata, the course
 * codes and outcomes the author already uses, and the alignment planner.
 *
 * Why: `PED-030` gives every activity learning-design metadata, and `PED-031` plans one course's outcomes × phases
 *      (D-087, D-088). This is W3's one router, mounted by the studio router; it registers no routes until W3 adds
 *      them.
 * Spec: PED-030, PED-031
 * Auth: portal — a signed-in author, with the CSRF token on writes; only people who may Edit an activity read or
 *   write its metadata (D-087). Every route starts with `requirePortalAuthor` (./studioPrincipal.ts).
 * Errors: W3 lists its own as it adds routes; D-087 names 400 `error.badRequest` for a body over the limits, 404
 *   `hvl:activity-unavailable` for an activity the person cannot see (D-066) and 409 `hvl:learning-design-conflict`
 *   for a stale `updatedAt`.
 * Invariants:
 *   - Learners never get the rationale; the minutes and the purpose reach them only after the View check (D-087).
 *   - Every route here is listed in packages/api-contract/src/routes/learningDesignRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../../server/studioServices.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/studioRouter.test.ts
 */
import { Router } from 'express';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the learning-design routes.
 * @param _deps - The studio's route inputs; this area uses `studio.learningDesignStore`, `access` and `clock`.
 * @returns A router to mount at the root of the studio router.
 * @spec PED-030
 */
export function learningDesignRoutes(_deps: StudioRouteDeps): Router {
  return Router();
}
