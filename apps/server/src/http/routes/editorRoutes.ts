/**
 * editorRoutes — the portal's editor pages: `/h5p/edit/:contentId` and `/h5p/new`.
 *
 * Why: authors build and change activities in H5P's editor (D-040, D-067). The page is server-rendered under the
 *      strict H5P policy and framed by the web app's activity page on our own origin.
 * Spec: H5P-002, H5P-006, PROD-002, DATA-011
 * Invariants:
 *   - Without a session the browser goes to Feide login and back; learners get 403 (`requireRole`).
 *   - An activity the author may not edit, or that does not exist, gets the one "not available" page (404).
 *   - Pages are `no-store`, framed only by our own origin, with the strict H5P page policy (D-070).
 * Collaborators: ../editorView.ts, ../h5pPageCsp.ts, ../securityHeaders.ts, ../pages/portalPages.ts.
 * Tests: apps/server/test/http/editorRoutes.int.test.ts
 */
import { Router, type Request, type Response } from 'express';
import { safeReturnTo } from '../../auth/returnTo.js';
import type { HvlH5pActor } from '../../h5p/HvlH5pUser.js';
import { editorView } from '../editorView.js';
import { h5pPageCsp } from '../h5pPageCsp.js';
import { requireRole } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { sendPortalPage } from '../pages/portalPages.js';
import { pathParam } from '../routeParams.js';
import { setPortalFrameHeaders } from '../securityHeaders.js';

/**
 * Builds the editor routes.
 * @param deps - The H5P runtime.
 * @returns A router for `GET /edit/:contentId` and `GET /new`.
 */
export function editorRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
  const authorsOnly = requireRole('author', 'admin');

  const show = async (req: Request, res: Response, contentId: string | undefined) => {
    const actor = res.locals.h5pActor as HvlH5pActor;
    const html = await editorView(deps, actor, contentId);
    res.set('Cache-Control', 'no-store');
    if (html === undefined) {
      // SECURITY: unknown and foreign activities get the same page, so none is revealed (PROD-004).
      sendPortalPage(res, 404, {
        locale: actor.locale,
        titleKey: 'page.notAvailable.title',
        bodyKey: 'page.notAvailable.body',
      });
      return;
    }
    setPortalFrameHeaders(res);
    // SECURITY: the strict H5P page policy (D-070); framed by our own pages only.
    res.set('Content-Security-Policy', h5pPageCsp(deps.pageCsp, ["'self'"]));
    res.type('html').send(html);
  };

  const loginFirst = (req: Request, res: Response, next: () => void) => {
    if (res.locals.h5pActor) return next();
    // WHY: a portal page without a session asks the person to log in and comes back here (D-066).
    res.set('Cache-Control', 'no-store');
    res.redirect(302, `/auth/feide/login?returnTo=${encodeURIComponent(safeReturnTo(req.originalUrl))}`);
  };

  router.get('/edit/:contentId', loginFirst, authorsOnly, (req, res) =>
    show(req, res, pathParam(req, 'contentId')),
  );
  router.get('/new', loginFirst, authorsOnly, (req, res) => show(req, res, undefined));
  return router;
}
