/**
 * webRoutes — hands every GET or HEAD request no Express route answered to the Next.js app.
 *
 * Why: Express owns sessions, tokens, APIs and the H5P pages; the web app is mounted last (D-068). Each page gets a
 *      fresh nonce policy (D-070) and Express's locale decision, and never sees the request's credentials. The LTI
 *      chrome page (`/app/play`) also gets the launch facts that ../lti/play/appLaunchRoutes.ts resolved.
 * Spec: DATA-011, LTI-003, LTI-006, PROD-012, UD-010
 * Invariants:
 *   - Only GET and HEAD reach Next.js; other methods fall through to the HTML 404 (no server actions, D-068).
 *   - The response's `Content-Security-Policy` and the request's copy carry the same nonce.
 *   - Portal pages are framed only by our own origin (with `X-Frame-Options: SAMEORIGIN`). A page with a launch is
 *     framed by our origin and `CANVAS_ORIGINS`, never sends `X-Frame-Options`, and is `no-store` (LTI-003).
 *   - The locale is the launch's, else the portal session's, else Nynorsk.
 * Collaborators: ./nextWebApp.ts, ./webPageCsp.ts, ./webRequestContract.ts, ./appLaunch.ts, ../server/createApp.ts.
 * Tests: apps/server/test/web/webRoutes.int.test.ts, apps/server/test/web/webApp.browser.int.test.ts
 */
import type { RequestHandler } from 'express';
import { portalSessionOf } from '../auth/session/portalSessionMiddleware.js';
import { appLaunchOf, LAUNCH_HEADER, launchHeaderValue } from './appLaunch.js';
import type { WebApp } from './nextWebApp.js';
import { createNonce, webPageCsp } from './webPageCsp.js';
import { prepareWebRequest } from './webRequestContract.js';

/** Options of the hand-over. */
export interface WebRouteOptions {
  /** `CANVAS_ORIGINS`, which may frame pages that serve a launch. */
  readonly canvasOrigins?: readonly string[];
  /** Origins the logout form's redirect may reach (Feide's issuer origin). */
  readonly formActionOrigins?: readonly string[];
}

/**
 * Builds the handler.
 * @param web - The loaded web app.
 * @param options - The Canvas origins for launch pages and the Feide origin for the logout form.
 * @returns Express middleware for the end of the chain.
 */
export function webRoutes(
  web: Pick<WebApp, 'dev' | 'handle'>,
  options: WebRouteOptions = {},
): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const launch = appLaunchOf(res);
    const frameAncestors = launch ? ["'self'", ...(options.canvasOrigins ?? [])] : ["'self'"];
    const csp = webPageCsp({
      nonce: createNonce(),
      dev: web.dev,
      frameAncestors,
      formActionOrigins: options.formActionOrigins ?? [],
    });
    const locale = launch?.locale ?? portalSessionOf(res)?.session.locale ?? 'nn';
    res.setHeader('Content-Security-Policy', csp);
    if (launch) {
      // SECURITY: X-Frame-Options cannot list Canvas origins and would block the iframe (LTI-003).
      res.removeHeader('X-Frame-Options');
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    prepareWebRequest(req, { csp, locale });
    if (launch) req.headers[LAUNCH_HEADER] = launchHeaderValue(launch);
    web.handle(req, res).catch(next);
  };
}
