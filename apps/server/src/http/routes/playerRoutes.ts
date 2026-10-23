/**
 * playerRoutes — the page that plays one activity.
 *
 * Why: learners (and authors previewing) open an activity here; S3 embeds this page in Canvas. Lumi builds the
 *      player model with the actor's state view, so the learner's saved state is preloaded for their course,
 *      and our template (D-040) turns it into HTML without Lumi's unescaped JSON.
 * Spec: H5P-004, H5P-005, H5P-006, SEC-008, PROD-004
 * Invariants:
 *   - The user is `asStateUser(actor)` and the context is the actor's; the page never carries a user identifier.
 *   - No download, embed or copy buttons (exports go through the author's editor, H5P-006).
 *   - The page is never cached (it contains the learner's preloaded state).
 *   - Without a session the browser goes to Feide login and back (S3); an unknown, draft or invisible activity is
 *     the one friendly 404 page (PROD-004). Portal pages are framed only by our own origin.
 * Collaborators: ../../h5p/render/playerPage.ts, ../../h5p/H5pPlayerFactory.ts (identity renderer).
 * Tests: apps/server/test/http/player.int.test.ts
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import { Router } from 'express';
import { safeReturnTo } from '../../auth/returnTo.js';
import { asStateUser, type HvlH5pActor } from '../../h5p/HvlH5pUser.js';
import { renderPlayerPage } from '../../h5p/render/playerPage.js';
import { sendPortalPage } from '../pages/portalPages.js';
import { setPortalFrameHeaders } from '../securityHeaders.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { pathParam } from '../routeParams.js';
import { h5pPageCsp } from '../h5pPageCsp.js';

/** Buttons and frame of the player (H5P "display options"). */
export const PLAYER_DISPLAY_OPTIONS = Object.freeze({
  showFrame: true,
  showLicenseButton: true,
  showDownloadButton: false,
  showEmbedButton: false,
  showCopyButton: false,
  showH5PIcon: false,
});

/**
 * Builds the player route.
 * @param deps - The player (its renderer returns the model unchanged).
 * @returns A router for `GET /play/:contentId`.
 */
export function playerRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
  router.get('/play/:contentId', async (req, res) => {
    const actor = res.locals.h5pActor as HvlH5pActor | undefined;
    if (!actor) {
      // WHY: a portal page without a session asks the person to log in and comes back here (PROD-004, D-066).
      res.set('Cache-Control', 'no-store');
      res.redirect(302, `/auth/feide/login?returnTo=${encodeURIComponent(safeReturnTo(req.originalUrl))}`);
      return;
    }
    let model: IPlayerModel;
    try {
      model = (await deps.player.render(pathParam(req, 'contentId'), asStateUser(actor), actor.locale, {
        ...PLAYER_DISPLAY_OPTIONS,
        contextId: actor.contextId,
      })) as IPlayerModel;
    } catch (error) {
      const status = (error as { httpStatusCode?: unknown } | null)?.httpStatusCode;
      if (status !== 403 && status !== 404) throw error;
      // SECURITY: unknown, draft and invisible activities get the same page, so none is revealed (PROD-004, D-066).
      sendPortalPage(res, 404, {
        locale: actor.locale,
        titleKey: 'page.notAvailable.title',
        bodyKey: 'page.notAvailable.body',
      });
      return;
    }
    res.set('Cache-Control', 'no-store');
    setPortalFrameHeaders(res);
    // SECURITY: no inline script, first-party sources only (D-070, DATA-011); framed by our own pages only.
    res.set('Content-Security-Policy', h5pPageCsp(deps.pageCsp, ["'self'"]));
    res.type('html').send(renderPlayerPage(model, actor.locale));
  });
  return router;
}
