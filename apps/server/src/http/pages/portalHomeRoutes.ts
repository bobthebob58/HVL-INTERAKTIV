/**
 * portalHomeRoutes — the portal's start page in S3 (`GET /`) and the HTML 404 page for unknown paths.
 *
 * Why: Feide login returns to `/` by default and logout ends there, but the real portal (`apps/web`) arrives in S4
 *      (D-048). Until then the start page only says whether the person is signed in and offers login or logout, so
 *      the login flow can be tried end to end.
 * Spec: AUTH-001, AUTH-003, PROD-004
 * Invariants:
 *   - Logout is a POST form carrying the session's CSRF token as the `csrf` field (D-057); there is no GET logout.
 *   - Pages are `no-store` and framed only by our own origin.
 *   - The 404 page says nothing about why a path is unknown.
 * Collaborators: ./htmlPage.ts, ./portalPages.ts, ../../auth/session/portalSessionMiddleware.ts,
 *   ../../auth/feide/feideLoginRoutes.ts, ../../server/createApp.ts.
 * Tests: apps/server/test/server/createApp.int.test.ts
 */
import { Router, type RequestHandler } from 'express';
import { CSRF_PARAM } from '../../auth/session/csrfToken.js';
import { portalSessionOf } from '../../auth/session/portalSessionMiddleware.js';
import { t } from '../../i18n/translate.js';
import { setPortalFrameHeaders } from '../securityHeaders.js';
import { htmlPage, markup } from './htmlPage.js';
import { sendPortalPage } from './portalPages.js';

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
