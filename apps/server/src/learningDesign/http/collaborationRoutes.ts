/**
 * collaborationRoutes — the collaboration routes under `/api` (workstream W4): finding HVL staff, co-authors, the
 * content bank and duplicating an activity.
 *
 * Why: `PROD-007` lets HVL authors work on an activity together, share it through the content bank and copy it with
 *      its source kept (D-090, D-091, D-092). This is W4's one router, mounted by the studio router; it registers no
 *      routes until W4 adds them.
 * Spec: PROD-007
 * Auth: portal — a signed-in HVL author (Feide session), with the CSRF token on writes; LTI accounts and learners are
 *   refused, and student authors may not be found or added (D-090). Every route starts with `requirePortalAuthor`
 *   (./studioPrincipal.ts).
 * Errors: W4 lists its own as it adds routes; the decisions name 400 `hvl:coauthor-not-eligible`, 403
 *   `hvl:owner-only` and `hvl:duplicate-not-allowed`, 404 `hvl:activity-unavailable` (D-066), 409
 *   `hvl:coauthor-limit` and `hvl:bank-not-eligible`, 429 `hvl:rate-limited` and 500 `hvl:duplicate-failed`.
 * Invariants:
 *   - PRIVACY: the people search answers `{ userId, displayName }` only and never logs its query (D-090, DATA-009).
 *   - Copies go through `studio.duplicator`, which decides `duplicateRules` first (D-092).
 *   - Every route here is listed in packages/api-contract/src/routes/collaborationRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../../server/studioServices.ts, ../collaboration/ContentDuplicator.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/studioRouter.test.ts
 */
import { Router } from 'express';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the collaboration routes.
 * @param _deps - The studio's route inputs; this area uses `studio.peopleDirectory`, `studio.duplicator`, `db` and
 *   `access`.
 * @returns A router to mount at the root of the studio router.
 * @spec PROD-007
 */
export function collaborationRoutes(_deps: StudioRouteDeps): Router {
  return Router();
}
