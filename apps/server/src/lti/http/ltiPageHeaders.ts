/**
 * ltiPageHeaders — the response headers of every page that can carry an ltik or runs inside the Canvas iframe.
 *
 * Why: LTI-003 requires `Referrer-Policy: no-referrer`, `Content-Security-Policy: frame-ancestors` with only the
 *      configured Canvas origins and no `X-Frame-Options`. ltijs's own login and launch pages contain inline
 *      scripts, so their CSP allows exactly those scripts by hash (D-050); our own pages allow only same-origin
 *      static scripts (D-048). The H5P player's policy is ../../http/h5pPageCsp.ts (D-070).
 * Spec: LTI-003, LTI-001
 * Invariants:
 *   - `frame-ancestors` lists only `CANVAS_ORIGINS`, or `'none'` when none are configured, for the launch, login
 *     and Deep Linking pages (LTI-003). Pages that our own `/app/play` chrome frames (`/lti/play`, `/lti/edit`, and
 *     their error pages, matched as Express routes them) add `'self'` (D-067, D-070).
 *   - Every response is `no-store` and `no-referrer`; `X-Frame-Options` is removed if anything set it.
 *   - Inline scripts are allowed only by the SHA-256 of their exact text; JSON data blocks are not scripts.
 * Collaborators: ./ExpressRouterHttpHandler.ts, ./ltiErrorPages.ts, ../play/ltiPlayRoutes.ts,
 *   ../deepLinking/deepLinkRoutes.ts, ../../web/chromeRedirect.ts (the same pages, `isFramedByAppPlay`).
 * Tests: apps/server/test/lti/http/ltiPageHeaders.test.ts
 */
import { createHash } from 'node:crypto';
import type { Response } from 'express';

/**
 * The `frame-ancestors` directive for LTI pages.
 * @param ancestors - `CANVAS_ORIGINS`, with `'self'` first for a page our own chrome frames.
 * @returns e.g. `frame-ancestors https://hvl.instructure.com`.
 */
export const frameAncestors = (ancestors: readonly string[]): string =>
  `frame-ancestors ${ancestors.length > 0 ? ancestors.join(' ') : "'none'"}`;

// WHY: matched as Express routes them (no strict routing, no case sensitivity), so `/lti/play/` is the same page.
const FRAMED_BY_OUR_CHROME = /^\/lti\/(?:play|edit)\/?$/i;

/**
 * Tells whether a path is one of the LTI pages `/app/play` frames on our own origin (D-067).
 * @param path - The request path.
 * @returns True for `/lti/play` and `/lti/edit` (with or without a trailing slash, in any case).
 */
export const isFramedByAppPlay = (path: string): boolean => FRAMED_BY_OUR_CHROME.test(path);

/**
 * Who may frame an LTI page (or its error page), by path.
 * @param path - The request path, e.g. `/lti/play`.
 * @param canvasOrigins - `CANVAS_ORIGINS`.
 * @returns `'self'` and the Canvas origins for the pages our chrome frames, else the Canvas origins only.
 */
export const ltiPageAncestors = (path: string, canvasOrigins: readonly string[]): readonly string[] =>
  isFramedByAppPlay(path) ? ["'self'", ...canvasOrigins] : canvasOrigins;

const sha256 = (text: string): string =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** Matches `<script …>…</script>` without a `src`, capturing the attributes and the text. */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
const STYLE_ATTRIBUTE = /\sstyle="([^"]*)"/gi;

/**
 * The CSP for an HTML page that ltijs rendered, allowing its inline scripts and style attributes by hash.
 * @param html - The page exactly as it will be sent.
 * @param canvasOrigins - `CANVAS_ORIGINS`.
 * @returns The header value.
 */
export function ltijsPageCsp(html: string, canvasOrigins: readonly string[]): string {
  const scripts = [...html.matchAll(INLINE_SCRIPT)]
    // WHY: `type="application/json"` blocks are data, which CSP neither runs nor checks.
    .filter(([, attributes]) => !/\stype=["']?application\/json/i.test(attributes ?? ''))
    .map(([, , text]) => sha256(text ?? ''));
  const styles = [...html.matchAll(STYLE_ATTRIBUTE)].map(([, text]) => sha256(text ?? ''));
  return [
    "default-src 'none'",
    `script-src 'self' ${[...new Set(scripts)].join(' ')}`.trim(),
    styles.length > 0 ? `style-src 'unsafe-hashes' ${[...new Set(styles)].join(' ')}` : "style-src 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    frameAncestors(canvasOrigins),
  ].join('; ');
}

/**
 * The CSP for our own LTI pages: same-origin static scripts and styles only.
 * @param ancestors - Who may frame the page: `CANVAS_ORIGINS`, plus `'self'` for a page our chrome frames.
 * @param extra - Further directives, e.g. `form-action` for a Deep Linking return URL.
 * @returns The header value.
 */
export function ltiPageCsp(ancestors: readonly string[], extra: readonly string[] = []): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "base-uri 'none'",
    ...(extra.some((d) => d.startsWith('form-action ')) ? [] : ["form-action 'self'"]),
    ...extra,
    frameAncestors(ancestors),
  ].join('; ');
}

/**
 * Sets the LTI-003 headers on a response.
 * @param res - The Express response.
 * @param csp - The Content-Security-Policy value.
 */
export function setLtiPageHeaders(res: Response, csp: string): void {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // SECURITY: X-Frame-Options cannot list several Canvas origins and would block the iframe (LTI-003).
  res.removeHeader('X-Frame-Options');
}
