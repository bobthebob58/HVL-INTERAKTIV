/**
 * mappeRoutes — the pedagogisk mappe routes under `/api` (workstream W6): the word-count preview and the Markdown and
 * PDF export.
 *
 * Why: `MAPPE-001` exports a teaching portfolio built from the author's activities, and `MAPPE-004` makes it a tagged
 *      PDF (D-094, D-096). This is W6's one router, mounted by the studio router; it registers no routes until W6
 *      adds them.
 * Spec: MAPPE-001, MAPPE-003, MAPPE-004
 * Auth: portal — a signed-in author (Feide session) with the CSRF token. Every route starts with
 *   `requirePortalAuthor` (./studioPrincipal.ts).
 * Errors: W6 lists its own as it adds routes; the decisions name 400 `hvl:criteria-set-unknown` and
 *   `hvl:mappe-too-many`, and 503 `hvl:pdf-unavailable` and `hvl:pdf-busy` (the Markdown export always works).
 * Invariants:
 *   - PRIVACY: aggregates pass the minimum group size (`MIN_GROUP_SIZE`, D-095), and an export is answered as a file
 *     and never stored on the server (MAPPE-003).
 *   - Every route here is listed in packages/api-contract/src/routes/mappeRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../../server/studioServices.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/studioRouter.test.ts
 */
import { Router } from 'express';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the mappe routes.
 * @param _deps - The studio's route inputs; this area uses `studio.mappeRenderer`, `studio.pdfRenderer` and `db`.
 * @returns A router to mount at the root of the studio router.
 * @spec MAPPE-001
 */
export function mappeRoutes(_deps: StudioRouteDeps): Router {
  return Router();
}
