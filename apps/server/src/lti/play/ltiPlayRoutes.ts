/**
 * ltiPlayRoutes — `/lti/play`, the H5P player inside Canvas, and the static scripts of the LTI pages.
 *
 * Why: after a launch ltijs redirects to `/lti/play?ltik=…` (LTI-003 step 1). The page plays the activity the
 *      launch opened, for the launch's person and course; its first script removes the ltik from the address bar
 *      (step 2), and H5P's own AJAX and user-data URLs carry the ltik (D-058).
 * Spec: LTI-003, LTI-006, LTI-007, H5P-007, PROD-004, PROD-012
 * Invariants:
 *   - The ltik in the query is accepted here (D-058); the activity comes from the stored launch, never the request.
 *   - Unknown, draft or invisible activities give the one 404 page; an invalid ltik the "reopen from Canvas" page.
 *   - The page is `no-store`, `no-referrer`, framed only by `CANVAS_ORIGINS`, and never sends `X-Frame-Options`.
 *   - Lumi's render runs with the View check (the player factory refuses the options that skip it).
 *   - Before H5P Core loads, the storage guard makes blocked frame storage safe for H5P (D-050).
 * Collaborators: ../ltikPrincipal.ts, ../../auth/principalToH5pActor.ts, ../../h5p/render/playerPage.ts,
 *   ../http/ltiPageHeaders.ts, ../pages/client/ltikLanding.js, ../pages/client/h5pStorageGuard.js, ../ltiRoutes.ts.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts, apps/server/test/lti/ltiPlay.int.test.ts
 */
import { fileURLToPath } from 'node:url';
import type { IPlayerModel } from '@lumieducation/h5p-server';
import express, { Router } from 'express';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { asStateUser } from '../../h5p/HvlH5pUser.js';
import { renderPlayerPage } from '../../h5p/render/playerPage.js';
import { authError } from '../../http/authErrors.js';
import type { H5pRouteDeps } from '../../http/h5pRouteDeps.js';
import { PLAYER_DISPLAY_OPTIONS } from '../../http/routes/playerRoutes.js';
import { setLtiPageLocale } from '../http/ltiErrorPages.js';
import { ltiPlayerCsp, setLtiPageHeaders } from '../http/ltiPageHeaders.js';
import type { ResolvedLtik } from '../ltikPrincipal.js';

/** Where the LTI page scripts are served. */
export const LTI_STATIC_PATH = '/static/lti';
/** The player page's first script. */
export const LTIK_LANDING_SCRIPT = `${LTI_STATIC_PATH}/ltikLanding.js`;
/** Runs before H5P Core so it survives blocked frame storage (./../pages/client/h5pStorageGuard.js). */
export const H5P_STORAGE_GUARD_SCRIPT = `${LTI_STATIC_PATH}/h5pStorageGuard.js`;

const CLIENT_DIR = fileURLToPath(new URL('../pages/client/', import.meta.url));

const statusOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { httpStatusCode?: unknown }).httpStatusCode
    : undefined;

/** What the player route needs. */
export interface LtiPlayDeps {
  readonly player: H5pRouteDeps['player'];
  /** Resolves the request's ltik into its launch (../ltikPrincipal.ts). */
  readonly resolveLtik: (ltik: string) => Promise<ResolvedLtik>;
  readonly canvasOrigins: readonly string[];
}

/**
 * Builds the LTI player route and the static route for the LTI page scripts.
 * @param deps - The H5P player, the ltik resolver and the Canvas origins.
 * @returns A router to mount at `/`.
 */
export function ltiPlayRoutes(deps: LtiPlayDeps): Router {
  const router = Router();
  router.use(LTI_STATIC_PATH, express.static(CLIENT_DIR, { index: false, fallthrough: false, maxAge: 0 }));
  router.get('/lti/play', async (req, res) => {
    const ltik = typeof req.query.ltik === 'string' ? req.query.ltik : '';
    if (ltik === '') throw authError('hvl:ltik-invalid');
    const { principal } = await deps.resolveLtik(ltik);
    setLtiPageLocale(res, principal.locale);
    const contentId = principal.lti?.contentId;
    if (!contentId) throw authError('hvl:activity-unavailable');
    const actor = principalToH5pActor(principal, { name: 'ltik', value: ltik });
    let model: IPlayerModel;
    try {
      model = (await deps.player.render(contentId, asStateUser(actor), actor.locale, {
        ...PLAYER_DISPLAY_OPTIONS,
        contextId: actor.contextId,
      })) as IPlayerModel;
    } catch (error) {
      // SECURITY: a refused or missing activity looks the same as one that does not exist (D-066).
      if (statusOf(error) === 403 || statusOf(error) === 404) throw authError('hvl:activity-unavailable');
      throw error;
    }
    setLtiPageHeaders(res, ltiPlayerCsp(deps.canvasOrigins));
    res.type('html').send(
      renderPlayerPage(model, actor.locale, {
        firstScripts: [LTIK_LANDING_SCRIPT, H5P_STORAGE_GUARD_SCRIPT],
      }),
    );
  });
  return router;
}
