/**
 * mappeRoutes — the pedagogisk mappe routes under `/api` (workstream W6): the activities to pick from, the criteria
 * sets, the word-count preview and the Markdown and PDF export.
 *
 * Why: `MAPPE-001` exports a teaching portfolio built from the author's activities, and `MAPPE-004` makes it a tagged
 *      PDF (D-094, D-096). This is W6's one router, mounted by the studio router.
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003, MAPPE-004
 * Auth: portal — a signed-in author (Feide session), with the CSRF token on the two POSTs. Every route starts with
 *   `requirePortalAuthor` (./studioPrincipal.ts).
 * Errors: 401 `hvl:unauthenticated` (signed out, or a Canvas ltik), `hvl:session-expired`, `hvl:ltik-invalid`,
 *   `hvl:csrf-invalid`; 403 `error.forbidden` (a portal learner); 400 `error.badRequest` (body or query),
 *   `hvl:mappe-too-many` (more than 50 activities) and `hvl:criteria-set-unknown`; 404 `hvl:activity-unavailable`
 *   (an activity that is not the author's own or co-authored, D-066); 409 `hvl:mappe-not-ready` (no mappe files in
 *   the content yet); 503 `hvl:pdf-busy` (with `Retry-After`) and `hvl:pdf-unavailable` (the Markdown export always
 *   works).
 * Invariants:
 *   - Who asks is checked first, then the size of the request, and only then its body, so a refused caller learns
 *     nothing from a 400.
 *   - PRIVACY: aggregates pass the minimum group size (`MIN_GROUP_SIZE`, D-095), and an export is answered as a file
 *     and never stored on the server (MAPPE-003).
 *   - Registered with full paths below `/api` and the body parser on the route itself (no path-less `use`).
 *   - Every route here is listed in packages/api-contract/src/routes/mappeRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ./mappeAnswers.ts, ../mappe/MappeRenderer.ts, ../../http/api/apiBodies.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/mappe/mappeRoutes.int.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeExport.int.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeSession.int.test.ts, apps/server/test/http/api/studioRouter.test.ts,
 *   apps/server/test/http/api/apiDocs.int.test.ts
 */
import {
  MAPPE_MAX_ACTIVITIES,
  mappeExportQuerySchema,
  mappeRequestSchema,
  type MappeRequest,
} from '@hvl-interaktiv/api-contract';
import { Router, type Request, type Response } from 'express';
import { apiJson, parseBody } from '../../http/api/apiBodies.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { RenderedMappe } from '../mappe/MappeRenderer.js';
import { mappePreviewOf, sendMappeFile } from './mappeAnswers.js';
import { requirePortalAuthor, type PortalPrincipal } from './studioPrincipal.js';
import type { StudioRouteDeps } from './studioRouteDeps.js';

// WHY: 50 IDs of 36 characters with JSON quoting are about 2 kB; 16 kB still lets a longer list reach the
// `hvl:mappe-too-many` answer instead of the body parser's.
const MAPPE_BODY_LIMIT = '16kb';

/**
 * The request's body, checked: its size first, then the contract's schema.
 * @param body - `req.body`.
 * @returns The request.
 * @throws HttpError 400 `hvl:mappe-too-many` for more than 50 activities, and 400 `error.badRequest` otherwise.
 */
function mappeRequestOf(body: unknown): MappeRequest {
  const ids = (body as { contentIds?: unknown } | undefined)?.contentIds;
  if (Array.isArray(ids) && ids.length > MAPPE_MAX_ACTIVITIES)
    throw learningDesignError('hvl:mappe-too-many');
  return parseBody(mappeRequestSchema, body);
}

/**
 * Builds the mappe routes.
 * @param deps - The studio's route inputs; this area uses `studio.mappeRenderer`, `studio.pdfRenderer` and `clock`.
 * @returns A router to mount at the root of the studio router.
 * @spec MAPPE-001
 */
export function mappeRoutes(deps: StudioRouteDeps): Router {
  const router = Router();
  const mappe = () => deps.studio.mappeRenderer;
  const rendered = async (req: Request, principal: PortalPrincipal, now: Date): Promise<RenderedMappe> => {
    const request = mappeRequestOf(req.body);
    return mappe().render({
      userId: principal.userId,
      contentIds: request.contentIds,
      ...(request.criteriaSet ? { criteriaSet: request.criteriaSet } : {}),
      locale: request.locale,
      now,
    });
  };

  router.get('/mappe/activities', async (_req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await mappe().activities(principal.userId));
  });

  router.get('/mappe/criteria-sets', (_req, res: Response) => {
    requirePortalAuthor(res);
    res.json(mappe().criteriaSets());
  });

  router.post('/mappe/preview', apiJson(MAPPE_BODY_LIMIT), async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(mappePreviewOf(await rendered(req, principal, deps.clock())));
  });

  router.post('/mappe/export', apiJson(MAPPE_BODY_LIMIT), async (req, res) => {
    const principal = requirePortalAuthor(res);
    const { format } = parseBody(mappeExportQuerySchema, { ...req.query });
    const now = deps.clock();
    const portfolio = await rendered(req, principal, now);
    await sendMappeFile(res, portfolio, {
      format,
      userId: principal.userId,
      pdf: deps.studio.pdfRenderer,
      now,
    });
  });
  return router;
}
