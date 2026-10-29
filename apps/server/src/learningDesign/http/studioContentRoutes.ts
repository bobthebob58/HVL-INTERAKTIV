/**
 * studioContentRoutes — the public studio routes under `/api` (workstream W1): the overview (the phases, the
 * *samling* anchor and the pattern catalogue), the guide in one language as a closed node tree, and one pattern's
 * detail, all from the studio content loaded at start-up.
 *
 * Why: the web app reads no files (D-068), so the guide and the catalogue reach it as read-only JSON (D-082), and
 *      the owner made them public on 2026-10-28 (D-089). This is W1's one router, mounted by the studio router.
 * Spec: PED-001, PED-002, PED-003, PED-011
 * Auth: none — anyone may read these routes, signed in or not (D-089): the authentication middleware sets no
 *   principal for a signed-out request, so a route here never calls `requirePrincipal`, and an LTI launch or a
 *   portal session gets the same answer. That middleware still refuses (401) a bad ltik.
 * Errors: 404 `error.notFound` for a language other than nn, nb and en, and for an unknown pattern (a malformed ID
 *   alike).
 * Invariants:
 *   - Answers only from `deps.studio.content` and the pattern creator's availability (./studioContentAnswers.ts),
 *     kept for a minute per pattern (./patternAvailabilityMemo.ts) because these routes need no sign-in; never reads
 *     `content/` again and never reads the database, so an answer holds nothing about people.
 *   - Every route is registered with its full path below `/api` and no middleware of its own; each is listed in
 *     packages/api-contract/src/routes/studioRoutes.ts with `auth: 'none'` (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioContentAnswers.ts,
 *   ./patternAvailabilityMemo.ts, ../../http/routeParams.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/http/studioContentRoutes.int.test.ts,
 *   apps/server/test/learningDesign/http/patternAvailabilityMemo.test.ts,
 *   apps/server/test/learningDesign/http/studioContentAnswers.test.ts, apps/server/test/http/api/studioRouter.test.ts,
 *   apps/server/test/http/api/apiDocs.int.test.ts
 */
import { localeSchema } from '@hvl-interaktiv/api-contract';
import { Router } from 'express';
import { HttpError } from '../../http/HttpError.js';
import { pathParam } from '../../http/routeParams.js';
import { memoizePatternAvailability } from './patternAvailabilityMemo.js';
import { guideAnswer, patternDetailAnswer, studioOverviewAnswer } from './studioContentAnswers.js';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the public studio content routes.
 * @param deps - The studio's route inputs; this area reads `studio.content` and `studio.patternCreator`.
 * @returns A router to mount at the root of the studio router.
 * @spec PED-001
 */
export function studioContentRoutes(deps: StudioRouteDeps): Router {
  const router = Router();
  const { content } = deps.studio;
  // SECURITY: public routes; the memo keeps an anonymous visitor from rebuilding every skeleton on each request.
  const patternCreator = memoizePatternAvailability(deps.studio.patternCreator);
  router.get('/studio', async (_req, res) => {
    res.json(await studioOverviewAnswer(content, patternCreator));
  });
  router.get('/studio/guide/:locale', (req, res) => {
    const locale = localeSchema.safeParse(pathParam(req, 'locale'));
    if (!locale.success) throw new HttpError(404, 'error.notFound');
    res.json(guideAnswer(content, locale.data));
  });
  router.get('/studio/patterns/:patternId', async (req, res) => {
    const detail = await patternDetailAnswer(content, patternCreator, pathParam(req, 'patternId'));
    if (!detail) throw new HttpError(404, 'error.notFound');
    res.json(detail);
  });
  return router;
}
