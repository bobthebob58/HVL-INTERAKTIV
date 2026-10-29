/**
 * learningDesignRoutes — the learning-design routes under `/api` (workstream W3): an activity's metadata, the course
 * codes and outcomes the author already uses, and the alignment planner.
 *
 * Why: `PED-030` gives every activity learning-design metadata, and `PED-031` plans one course's outcomes × phases
 *      (D-087, D-088). This is W3's one router, mounted by the studio router.
 * Spec: PED-030, PED-031
 * Auth: portal — a signed-in author, with the CSRF token on writes; only people who may Edit an activity read or
 *   write its metadata (D-087). Every route starts with `requirePortalAuthor` (./studioPrincipal.ts).
 * Errors: 401 `hvl:unauthenticated` (signed out, or a Canvas ltik), `hvl:session-expired`, `hvl:ltik-invalid`,
 *   `hvl:csrf-invalid`; 403 `error.forbidden` (a portal learner) and `hvl:edit-not-allowed` (may view, not edit);
 *   404 `hvl:activity-unavailable` (unknown or not viewable, D-066); 400 `error.badRequest` (a body over D-087's
 *   limits, or a query without a valid course code); 409 `hvl:learning-design-conflict` (a stale `updatedAt`).
 * Invariants:
 *   - Who asks is checked first, then the Edit decision, and only then the body, so a refused caller learns nothing
 *     from a 400.
 *   - Learners never get the rationale; the minutes and the purpose reach them only after the View check, through
 *     the activity summary and the Canvas launch, never through these routes (D-087).
 *   - Registered with full paths below `/api` and the body parser on the route itself (no path-less `use`).
 *   - Every route here is listed in packages/api-contract/src/routes/learningDesignRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../metadata/LearningDesignStore.ts, ../../content/contentAccess.ts, ../../http/api/apiBodies.ts,
 *   @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/metadata/learningDesignRoutes.int.test.ts,
 *   apps/server/test/learningDesign/metadata/learningDesignReplace.int.test.ts,
 *   apps/server/test/learningDesign/metadata/learningDesignSession.int.test.ts,
 *   apps/server/test/learningDesign/metadata/courseCodeRoutes.int.test.ts,
 *   apps/server/test/learningDesign/metadata/plannerRoutes.int.test.ts, apps/server/test/http/api/studioRouter.test.ts,
 *   apps/server/test/http/api/apiDocs.int.test.ts
 */
import { courseCodeQuerySchema, learningDesignUpdateSchema } from '@hvl-interaktiv/api-contract';
import { Router, type Request, type Response } from 'express';
import { editableContent } from '../../content/contentAccess.js';
import { apiJson, parseBody } from '../../http/api/apiBodies.js';
import { pathParam } from '../../http/routeParams.js';
import { requirePortalAuthor } from './studioPrincipal.js';
import type { StudioRouteDeps } from './studioRouteDeps.js';

const METADATA_PATH = '/content/:contentId/learning-design';

/**
 * The course code of a request's query (`?courseCode=SYK110`), normalised.
 * @param req - The request.
 * @returns The normalised course code.
 * @throws HttpError 400 `error.badRequest` when it is missing, invalid, repeated or joined by other parameters.
 */
const courseCodeOf = (req: Request): string => parseBody(courseCodeQuerySchema, { ...req.query }).courseCode;

/**
 * Builds the learning-design routes.
 * @param deps - The studio's route inputs; this area uses `studio.learningDesignStore`, `access` and `clock`.
 * @returns A router to mount at the root of the studio router.
 * @spec PED-030
 */
export function learningDesignRoutes(deps: StudioRouteDeps): Router {
  const router = Router();
  const store = () => deps.studio.learningDesignStore;
  // SECURITY: the person first, then the Edit decision (D-087); viewers and learners never get the metadata.
  const editable = async (req: Request, res: Response): Promise<string> => {
    const principal = requirePortalAuthor(res);
    return (await editableContent(deps.access, principal, pathParam(req, 'contentId'))).facts.contentId;
  };

  router.get(METADATA_PATH, async (req, res) => {
    const contentId = await editable(req, res);
    res.json(await store().read(contentId));
  });

  // WHY: 20 outcomes of 300 characters, a rationale of 1 000 and a purpose of 200, each up to six bytes a character
  // as JSON escapes, stay well under 64 kB.
  router.put(METADATA_PATH, apiJson('64kb'), async (req, res) => {
    const contentId = await editable(req, res);
    const update = parseBody(learningDesignUpdateSchema, req.body);
    res.json(await store().replace(contentId, update, deps.clock()));
  });

  router.get('/learning-design/course-codes', async (_req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await store().courseCodes(principal.userId));
  });

  router.get('/learning-design/outcomes', async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await store().courseOutcomes(principal.userId, courseCodeOf(req)));
  });

  router.get('/learning-design/planner', async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await store().planner(principal.userId, courseCodeOf(req)));
  });
  return router;
}
