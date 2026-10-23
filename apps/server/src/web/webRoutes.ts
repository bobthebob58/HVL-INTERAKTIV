/**
 * webRoutes — hands every GET or HEAD request no Express route answered to the Next.js app.
 *
 * Why: Express owns sessions, tokens, APIs and the H5P pages; the web app is mounted last (D-068). Each page gets a
 *      fresh nonce policy (D-070) and the locale of the portal session, and never sees the request's credentials.
 * Spec: DATA-011, LTI-003, PROD-012, UD-010
 * Invariants:
 *   - Only GET and HEAD reach Next.js; other methods fall through to the HTML 404 (no server actions, D-068).
 *   - The response's `Content-Security-Policy` and the request's copy carry the same nonce.
 *   - Pages are framed only by our own origin (`X-Frame-Options: SAMEORIGIN` as well).
 * Collaborators: ./nextWebApp.ts, ./webPageCsp.ts, ./webRequestContract.ts, ../server/createApp.ts.
 * Tests: apps/server/test/web/webRoutes.int.test.ts, apps/server/test/web/webApp.browser.int.test.ts
 */
import type { RequestHandler } from 'express';
import { portalSessionOf } from '../auth/session/portalSessionMiddleware.js';
import type { WebApp } from './nextWebApp.js';
import { createNonce, webPageCsp } from './webPageCsp.js';
import { prepareWebRequest } from './webRequestContract.js';

/**
 * Builds the handler.
 * @param web - The loaded web app.
 * @returns Express middleware for the end of the chain.
 */
export function webRoutes(web: Pick<WebApp, 'dev' | 'handle'>): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const csp = webPageCsp({ nonce: createNonce(), dev: web.dev, frameAncestors: ["'self'"] });
    const locale = portalSessionOf(res)?.session.locale ?? 'nn';
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    prepareWebRequest(req, { csp, locale });
    web.handle(req, res).catch(next);
  };
}
