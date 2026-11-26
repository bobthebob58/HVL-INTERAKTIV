/**
 * securityHeaders — the headers every response carries, the framing and opener rules for portal pages, and the
 * rules for an answer that is about the signed-in person.
 *
 * Why: tokens travel in some URLs (D-058), so no response may leak its URL through `Referer`; content must not be
 *      MIME-sniffed (SEC-004); production is https-only. Portal pages may be framed only by our own origin (the
 *      H5P editor frames itself); LTI pages set their own `frame-ancestors` for Canvas (./lti/http/ltiPageHeaders).
 * Spec: LTI-003, SEC-004, AUTH-003
 * Invariants:
 *   - Every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
 *     `X-Permitted-Cross-Domain-Policies: none`; `Strict-Transport-Security` when the public URL is https, with
 *     `includeSubDomains` only when `HSTS_INCLUDE_SUBDOMAINS` says every name under the host is https (D-133).
 *   - Every response starts with the policy `default-src 'none'; frame-ancestors 'none'` (`DEFAULT_CSP`): an
 *     answer that is not meant as a page (a status, an error, a file) loads and runs nothing and is framed by
 *     nothing if a browser shows it as one. Every page replaces it with its own policy (D-133).
 *   - Portal pages the server renders (the H5P pages, the message pages): `frame-ancestors 'self'` and
 *     `X-Frame-Options: SAMEORIGIN`, since the web app shows them in its frames; until the page sets its own
 *     policy, `default-src 'none'` stays with it. The web app's own pages are framed by nothing
 *     (../web/webRoutes.ts, D-125). LTI pages never get X-Frame-Options.
 *   - Portal pages also send `Cross-Origin-Opener-Policy: same-origin`, so a window of another site holds no handle
 *     on them. LTI pages never do: Canvas and the launch's storage messages need the handle (D-131, D-050).
 *   - An answer about the signed-in person (`/api`, `/auth/session`, the H5P routes behind authentication):
 *     `Cache-Control: no-store`, `Cross-Origin-Resource-Policy: same-origin` and the portal framing rule, so no
 *     cache keeps it and no other site embeds or frames it; a route may still set a stricter rule of its own.
 * Collaborators: ../server/createApp.ts, ../lti/http/ltiPageHeaders.ts, ./createH5pRouter.ts, ./api/apiRouter.ts,
 *   ../auth/feide/feideLoginRoutes.ts, ../web/webRoutes.ts.
 * Tests: apps/server/test/http/securityHeaders.test.ts
 */
import type { RequestHandler, Response } from 'express';

/** The header that says which windows may keep a handle on a page. */
export const OPENER_POLICY = 'Cross-Origin-Opener-Policy';

/** One year, in seconds: the HSTS lifetime. */
export const HSTS_MAX_AGE = 31_536_000;

/** The policy of an answer that sets none of its own: it loads nothing, runs nothing and is framed by nothing. */
export const DEFAULT_CSP = "default-src 'none'; frame-ancestors 'none'";

/** What the base headers depend on. */
export interface BaseHeaderOptions {
  /** Whether the public base URL is https (then HSTS is sent). */
  readonly https: boolean;
  /** Whether HSTS also covers every name under the host (`HSTS_INCLUDE_SUBDOMAINS`); off by default. */
  readonly includeSubDomains?: boolean;
}

/**
 * Middleware that sets the headers every response carries.
 * @param options - Whether the public base URL is https, and whether HSTS covers the names under its host.
 * @returns Express middleware.
 */
export function baseSecurityHeaders(options: BaseHeaderOptions): RequestHandler {
  const hsts = `max-age=${HSTS_MAX_AGE}${options.includeSubDomains ? '; includeSubDomains' : ''}`;
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // SECURITY: URLs can hold an ltik or CSRF token (D-058); no page may send them on as a Referer.
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    // SECURITY: the default for whatever sets no policy of its own; every page replaces it (D-133).
    res.setHeader('Content-Security-Policy', DEFAULT_CSP);
    if (options.https) res.setHeader('Strict-Transport-Security', hsts);
    next();
  };
}

/**
 * Sets the framing rule for a portal page.
 * @param res - The response of a page outside Canvas.
 */
export function setPortalFrameHeaders(res: Response): void {
  // SECURITY: `default-src 'none'` stays until the page sets its own policy; a JSON answer never does (D-133).
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // SECURITY: a window of another site that opened this page, or that it opened, gets no handle on it (D-131).
  res.setHeader(OPENER_POLICY, 'same-origin');
}

/**
 * Middleware for routes whose answers are about the signed-in person.
 * @param _req - The request.
 * @param res - The response; a route may set a stricter cache or framing rule after this.
 * @param next - The next handler.
 */
export const ownAnswerHeaders: RequestHandler = (_req, res, next) => {
  // SECURITY: not kept by any cache, and not readable by another site that embeds the address as a script or an
  // image with the person's cookie (D-131).
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  setPortalFrameHeaders(res);
  next();
};
