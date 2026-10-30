/**
 * patternRoutes — the pattern routes under `/api`: `POST /api/patterns/:patternId/activities` creates a draft
 * activity from a pattern, with its learning-design metadata, in one request.
 *
 * Why: `PROD-001` opens the editor on a pedagogically sound skeleton, and D-085 builds that skeleton on the server so
 *      the metadata never travels through the browser and a test can create every pattern. This is the area's one
 *      router, mounted by the studio router (../../http/api/studioRouter.ts).
 * Spec: PROD-001, PED-010, PED-011
 * Auth: portal — a signed-in portal author (Feide session) with the CSRF token; an LTI launch is refused (the Canvas
 *   side waits for S6, D-098). Every route starts with `requirePortalAuthor` (./studioPrincipal.ts).
 * Errors: 401 `hvl:unauthenticated` (signed out, or a Canvas ltik), `hvl:session-expired`, `hvl:ltik-invalid`,
 *   `hvl:csrf-invalid`; 403 `error.forbidden` (a portal learner); 400 `error.badRequest` (the body) and
 *   `hvl:pattern-choice-invalid` (a phase or content type the pattern does not offer); 404 `error.notFound` (no such
 *   pattern); 409 `hvl:pattern-unavailable` (a library the skeleton needs is not installed); an editor refusal
 *   (4xx) passes through.
 * Invariants:
 *   - The principal is checked before the body, so someone who may not create learns nothing from a 400.
 *   - Saves only through `HvlH5PEditor`'s save path (`studio.patternCreator`), so every editor check runs (D-085).
 *   - Registered with its full path below `/api` and its body parser on the route itself (no path-less `use`).
 *   - Every route here is listed in packages/api-contract/src/routes/patternRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../patterns/PatternCreator.ts, ../../auth/principalToH5pActor.ts, ../../http/api/apiBodies.ts,
 *   @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/http/patternRoutes.int.test.ts (who may call it),
 *   apps/server/test/learningDesign/patterns/patternCreation.int.test.ts,
 *   apps/server/test/learningDesign/patterns/patternCreationGuards.int.test.ts,
 *   apps/server/test/http/api/studioRouter.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import { patternActivityRequestSchema } from '@hvl-interaktiv/api-contract';
import { Router } from 'express';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { apiJson, parseBody } from '../../http/api/apiBodies.js';
import { pathParam } from '../../http/routeParams.js';
import { requirePortalAuthor } from './studioPrincipal.js';
import type { StudioRouteDeps } from './studioRouteDeps.js';

/**
 * Builds the pattern routes.
 * @param deps - The studio's route inputs; this area uses `studio.patternCreator`.
 * @returns A router to mount at the root of the studio router.
 * @spec PROD-001
 */
export function patternRoutes(deps: StudioRouteDeps): Router {
  const router = Router();
  // WHY: the body holds four short fields (a language, a phase, a course code and a content type).
  router.post('/patterns/:patternId/activities', apiJson('1kb'), async (req, res) => {
    const principal = requirePortalAuthor(res);
    const request = parseBody(patternActivityRequestSchema, req.body);
    const created = await deps.studio.patternCreator.create(
      pathParam(req, 'patternId'),
      request,
      principalToH5pActor(principal),
    );
    res.status(201).json(created);
  });
  return router;
}
