/**
 * ltiEditRoutes — `/lti/edit`, the H5P editor inside Canvas for the activity a launch opened (LTI-006 **Rediger**).
 *
 * Why: an author who opens their activity from a Canvas course can change it without leaving Canvas (D-062). The
 *      page runs in the cookie-less Canvas iframe, so its own requests carry the ltik as a Bearer token, H5P's
 *      AJAX and state URLs carry it in the query, and file URLs carry signed grants (D-058, D-069).
 * Spec: LTI-006, LTI-003, H5P-006, H5P-007
 * Invariants:
 *   - The ltik in the query is accepted here (D-069); the activity comes from the stored launch, never the request.
 *   - The editor is shown only after the Edit check for the launch's person; anyone else, and an activity that is
 *     gone, gets the one "not available" page; an invalid ltik the "reopen from Canvas" page.
 *   - Headers as on `/lti/play`: `no-store`, `no-referrer`, the strict H5P policy framed by our chrome and Canvas.
 *   - The landing script removes the ltik from the address bar and the storage guard runs before H5P (D-050).
 * Collaborators: ../../http/editorView.ts, ./ltiPlayRoutes.ts (scripts, same headers), ../ltikPrincipal.ts,
 *   ../../auth/principalToH5pActor.ts, ../ltiRoutes.ts.
 * Tests: apps/server/test/lti/ltiEdit.int.test.ts, apps/server/e2e/ltiEditor.e2e.test.ts
 */
import { Router } from 'express';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { authError } from '../../http/authErrors.js';
import { editorView, type EditorViewDeps } from '../../http/editorView.js';
import { h5pPageCsp } from '../../http/h5pPageCsp.js';
import type { H5pRouteDeps } from '../../http/h5pRouteDeps.js';
import { setLtiPageLocale } from '../http/ltiErrorPages.js';
import { setLtiPageHeaders } from '../http/ltiPageHeaders.js';
import type { ResolvedLtik } from '../ltikPrincipal.js';
import { H5P_STORAGE_GUARD_SCRIPT, LTIK_LANDING_SCRIPT } from './ltiPlayRoutes.js';

/** What the LTI editor route needs. */
export interface LtiEditDeps {
  /** Editor, permission system and upload grants. */
  readonly editor: EditorViewDeps;
  /** Resolves the request's ltik into its launch (../ltikPrincipal.ts). */
  readonly resolveLtik: (ltik: string) => Promise<ResolvedLtik>;
  readonly canvasOrigins: readonly string[];
  /** The H5P page policy settings (D-070). */
  readonly pageCsp: H5pRouteDeps['pageCsp'];
}

/**
 * Builds the LTI editor route.
 * @param deps - The editor view's dependencies, the ltik resolver and the Canvas origins.
 * @returns A router for `GET /lti/edit`.
 */
export function ltiEditRoutes(deps: LtiEditDeps): Router {
  const router = Router();
  router.get('/lti/edit', async (req, res) => {
    const ltik = typeof req.query.ltik === 'string' ? req.query.ltik : '';
    if (ltik === '') throw authError('hvl:ltik-invalid');
    const { principal } = await deps.resolveLtik(ltik);
    setLtiPageLocale(res, principal.locale);
    const contentId = principal.lti?.contentId;
    if (!contentId) throw authError('hvl:activity-unavailable');
    const actor = principalToH5pActor(principal, { name: 'ltik', value: ltik });
    const html = await editorView(deps.editor, actor, contentId, [
      LTIK_LANDING_SCRIPT,
      H5P_STORAGE_GUARD_SCRIPT,
    ]);
    // SECURITY: no Edit right and no activity look the same (D-066).
    if (html === undefined) throw authError('hvl:activity-unavailable');
    setLtiPageHeaders(res, h5pPageCsp(deps.pageCsp, ["'self'", ...deps.canvasOrigins]));
    res.type('html').send(html);
  });
  return router;
}
