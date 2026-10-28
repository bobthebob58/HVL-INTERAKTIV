/**
 * studioContentRoutes — the public studio routes under `/api` (workstream W1): the guide as a closed node tree, the
 * phases, the references and the pattern catalogue with each pattern's detail, all from the studio content loaded at
 * start-up.
 *
 * Why: the web app reads no files (D-068), so the guide and the catalogue reach it as read-only JSON (D-082), and
 *      the owner made them public on 2026-10-28 (D-089). This is W1's one router, mounted by the studio router; it
 *      registers no routes until W1 adds them.
 * Spec: PED-001, PED-002, PED-003, PED-011
 * Auth: none — anyone may read these routes, signed in or not (D-089): the authentication middleware sets no
 *   principal for a signed-out request, so a route here never calls `requirePrincipal`. That middleware still
 *   refuses (401) a bad ltik, and a signed-in portal request with an unsafe method and no CSRF token.
 * Errors: W1 lists its own as it adds routes; an unknown pattern is 404 `error.notFound`.
 * Invariants:
 *   - Answers only from `deps.studio.content`; never reads `content/` again and never reads the database, so an answer
 *     holds nothing about people.
 *   - Every route here is listed in packages/api-contract/src/routes/studioRoutes.ts with `auth: 'none'` (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts,
 *   ../content/loadStudioContent.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/studioRouter.test.ts, apps/server/test/http/api/studioPublicRoute.int.test.ts
 */
import { Router } from 'express';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the public studio content routes.
 * @param _deps - The studio's route inputs; this area reads `studio.content` only.
 * @returns A router to mount at the root of the studio router.
 * @spec PED-001
 */
export function studioContentRoutes(_deps: StudioRouteDeps): Router {
  return Router();
}
