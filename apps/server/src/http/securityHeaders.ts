/**
 * securityHeaders — the headers every response carries, and the framing rule for portal pages.
 *
 * Why: tokens travel in some URLs (D-058), so no response may leak its URL through `Referer`; content must not be
 *      MIME-sniffed (SEC-004); production is https-only. Portal pages may be framed only by our own origin (the
 *      H5P editor frames itself); LTI pages set their own `frame-ancestors` for Canvas (./lti/http/ltiPageHeaders).
 * Spec: LTI-003, SEC-004, AUTH-003
 * Invariants:
 *   - Every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
 *     `X-Permitted-Cross-Domain-Policies: none`; `Strict-Transport-Security` when the public URL is https.
 *   - Portal pages: `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`; LTI pages never get X-Frame-Options.
 * Collaborators: ../server/createApp.ts, ../lti/http/ltiPageHeaders.ts.
 * Tests: apps/server/test/http/securityHeaders.test.ts
 */
import type { RequestHandler, Response } from 'express';

/** One year, in seconds: the HSTS lifetime. */
export const HSTS_MAX_AGE = 31_536_000;

/**
 * Middleware that sets the headers every response carries.
 * @param options - `https`: whether the public base URL is https (then HSTS is sent).
 * @returns Express middleware.
 */
export function baseSecurityHeaders(options: { https: boolean }): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // SECURITY: URLs can hold an ltik or CSRF token (D-058); no page may send them on as a Referer.
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    if (options.https) res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}`);
    next();
  };
}

/**
 * Sets the framing rule for a portal page.
 * @param res - The response of a page outside Canvas.
 */
export function setPortalFrameHeaders(res: Response): void {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}
