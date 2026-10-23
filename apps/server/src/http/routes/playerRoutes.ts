/**
 * playerRoutes — the page that plays one activity.
 *
 * Why: learners (and authors previewing) open an activity here; S3 embeds this page in Canvas. Lumi builds the
 *      player model with the actor's state view, so the learner's saved state is preloaded for their course,
 *      and our template (D-040) turns it into HTML without Lumi's unescaped JSON (A1).
 * Spec: H5P-004, H5P-005, H5P-006, SEC-008
 * Invariants:
 *   - The user is `asStateUser(actor)` and the context is the actor's; the page never carries a user identifier.
 *   - No download, embed or copy buttons (exports go through the author's editor, H5P-006).
 *   - The page is never cached (it contains the learner's preloaded state).
 * Collaborators: ../../h5p/render/playerPage.ts, ../../h5p/H5pPlayerFactory.ts (identity renderer).
 * Tests: apps/server/test/http/player.int.test.ts
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import { Router } from 'express';
import { asStateUser } from '../../h5p/HvlH5pUser.js';
import { renderPlayerPage } from '../../h5p/render/playerPage.js';
import { requireActor } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { pathParam } from '../routeParams.js';

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
    const actor = requireActor(res);
    const model = (await deps.player.render(pathParam(req, 'contentId'), asStateUser(actor), actor.locale, {
      ...PLAYER_DISPLAY_OPTIONS,
      contextId: actor.contextId,
    })) as IPlayerModel;
    res.set('Cache-Control', 'no-store');
    res.type('html').send(renderPlayerPage(model, actor.locale));
  });
  return router;
}
