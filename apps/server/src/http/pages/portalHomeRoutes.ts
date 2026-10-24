/**
 * portalHomeRoutes — the server's own start page (`GET /`) when the web app does not run, and the HTML 404 page for
 * unknown paths.
 *
 * Why: Feide login returns to `/` by default and logout ends there. With the web app (`WEB_APP` dev or prod) `/` is
 *      its start page (D-067) and createApp does not mount this one; with `WEB_APP=off` (integration tests, D-068)
 *      this page says whether the person is signed in and offers login or logout, so the login flow still works.
 * Spec: AUTH-001, AUTH-003, PROD-004, DATA-011
 * Invariants:
 *   - Logout is a POST form carrying the session's CSRF token as the `csrf` field (D-057); there is no GET logout.
 *   - Pages are `no-store` and framed only by our own origin. The start page loads our own files only, like the
 *     message pages (`portalPageCsp`), except that its logout form may post on: `/auth/logout` answers 303 to
 *     Feide's end-session endpoint, and browsers apply `form-action` to that redirect too (D-070 amendment).
 *   - The 404 page says nothing about why a path is unknown.
 * Collaborators: ./htmlPage.ts, ./portalPages.ts, ../../auth/session/portalSessionMiddleware.ts,
 *   ../../auth/feide/feideLoginRoutes.ts, ../../server/createApp.ts.
 * Tests: apps/server/test/http/pages/portalPages.test.ts, apps/server/test/server/createApp.int.test.ts
 */
import { Router, type RequestHandler } from 'express';
import { CSRF_PARAM } from '../../auth/session/csrfToken.js';
import { portalSessionOf } from '../../auth/session/portalSessionMiddleware.js';
import { t } from '../../i18n/translate.js';
import { setPortalFrameHeaders } from '../securityHeaders.js';
import { htmlPage, markup } from './htmlPage.js';
import { portalPageCsp, sendPortalPage } from './portalPages.js';

/**
 * Builds the start page route.
 * @returns A router for `GET /`.
 */
export function portalHomeRoutes(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const active = portalSessionOf(res);
    const locale = active?.session.locale ?? 'nn';
    const siteName = t('page.siteName', {}, locale);
    const body = active
      ? markup`<p>${t('page.home.signedIn', {}, locale)}</p>
<form method="post" action="/auth/logout">
<input type="hidden" name="${CSRF_PARAM}" value="${active.session.csrfToken}">
<button type="submit">${t('page.logout', {}, locale)}</button>
</form>`
      : markup`<p>${t('page.home.signedOut', {}, locale)}</p>
<p><a href="/auth/feide/login">${t('page.login', {}, locale)}</a></p>`;
    setPortalFrameHeaders(res);
    // WHY: this router does not know FEIDE_ISSUER, so `form-action` is left out; the page's only form is ours.
    res.setHeader('Content-Security-Policy', portalPageCsp({ formAction: false }));
    res.setHeader('Cache-Control', 'no-store');
    res
      .type('html')
      .send(htmlPage({ locale, title: siteName, main: markup`<h1>${siteName}</h1>\n${body}` }, siteName));
  });
  return router;
}

/**
 * The last route: an HTML 404 page for any path nothing else answered.
 * @returns Express middleware.
 */
export const portalNotFound = (): RequestHandler => (_req, res) =>
  sendPortalPage(res, 404, { locale: 'nn', titleKey: 'page.notFound.title', bodyKey: 'page.notFound.body' });
