/**
 * appLaunchRoutes — resolves the ltik of `/app/play` (the web app's chrome page inside Canvas) before the web app
 * renders it.
 *
 * Why: ltijs sends a launch to the chrome page with the ltik in the query (LTI-003 step 1, D-069). The web app must
 *      not see the ltik (D-068), so Express checks it here, inside the LTI router where an invalid ltik gets the
 *      friendly "open it again from Canvas" page with 401, and passes on only what the page shows (./../../web/appLaunch.ts).
 * Spec: LTI-006, LTI-003, PROD-004, H5P-006, UD-010
 * Invariants:
 *   - The activity is the launch's own (`principal.lti.contentId`), never from the request.
 *   - An activity the launch may not view gets the one "not available" page (D-066); its title and language are read
 *     only after that check.
 *   - `mayEdit` is the H5P-006 Edit decision for the launch's account view.
 *   - The request continues to the web app (`next()`); only GET reaches this route.
 * Collaborators: ../ltikPrincipal.ts, ../../auth/principalToH5pActor.ts, ../../h5p/permissions/contentRules.ts,
 *   ../../validation/activityLanguage.ts (via ../ltiRoutes.ts), ../../web/appLaunch.ts, ../../web/webRoutes.ts.
 * Tests: apps/server/test/lti/appLaunch.int.test.ts
 */
import { ContentPermission } from '@lumieducation/h5p-server';
import { Router } from 'express';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { asAccountUser, asStateUser } from '../../h5p/HvlH5pUser.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { decideContent } from '../../h5p/permissions/contentRules.js';
import { authError } from '../../http/authErrors.js';
import { setAppLaunch } from '../../web/appLaunch.js';
import { setLtiPageLocale } from '../http/ltiErrorPages.js';
import type { ResolvedLtik } from '../ltikPrincipal.js';

/** The chrome page's path; ltijs redirects here when the web app is loaded. */
export const APP_PLAY_PATH = '/app/play';

/** What the route needs. */
export interface AppLaunchDeps {
  /** Resolves the ltik from the address into the launch's principal; any failure is a 401 `hvl:ltik-invalid`. */
  readonly resolveLtik: (ltik: string) => Promise<ResolvedLtik>;
  readonly access: ContentAccessRepository;
  /** The activity's title, read after the View check. */
  readonly titleOf: (contentId: string) => Promise<string>;
  /** The activity's own language tag (../../validation/activityLanguage.ts), read after the View check. */
  readonly languageOf?: (contentId: string) => Promise<string | undefined>;
}

/**
 * Builds the route.
 * @param deps - The ltik resolver, the activity facts and the title and language lookups.
 * @returns A router for `GET /app/play`.
 */
export function appLaunchRoutes(deps: AppLaunchDeps): Router {
  const router = Router();
  router.get(APP_PLAY_PATH, async (req, res, next) => {
    const ltik = typeof req.query.ltik === 'string' ? req.query.ltik : '';
    if (ltik === '') throw authError('hvl:ltik-invalid');
    const { principal } = await deps.resolveLtik(ltik);
    setLtiPageLocale(res, principal.locale);
    const contentId = principal.lti?.contentId;
    const facts = contentId ? await deps.access.factsFor(contentId) : undefined;
    const actor = principalToH5pActor(principal, { name: 'ltik', value: ltik });
    // SECURITY: refused and unknown activities look the same (D-066); nothing about them is read before this.
    if (!contentId || !facts || !decideContent(asStateUser(actor), ContentPermission.View, facts)) {
      throw authError('hvl:activity-unavailable');
    }
    const language = await deps.languageOf?.(facts.contentId);
    setAppLaunch(res, {
      contentId: facts.contentId,
      title: await deps.titleOf(facts.contentId),
      mayEdit: decideContent(asAccountUser(actor), ContentPermission.Edit, facts),
      locale: principal.locale,
      ...(language ? { language } : {}),
    });
    next();
  });
  return router;
}
