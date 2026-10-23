/**
 * ltiPageHeaders — the response headers of every page that can carry an ltik or runs inside the Canvas iframe.
 *
 * Why: LTI-003 requires `Referrer-Policy: no-referrer`, `Content-Security-Policy: frame-ancestors` with only the
 *      configured Canvas origins and no `X-Frame-Options`. ltijs's own login and launch pages contain inline
 *      scripts, so their CSP allows exactly those scripts by hash (D-050); our own pages allow only same-origin
 *      static scripts (D-048).
 * Spec: LTI-003, LTI-001
 * Invariants:
 *   - `frame-ancestors` lists only `CANVAS_ORIGINS`, or `'none'` when none are configured.
 *   - Every response is `no-store` and `no-referrer`; `X-Frame-Options` is removed if anything set it.
 *   - Inline scripts are allowed only by the SHA-256 of their exact text; JSON data blocks are not scripts.
 * Collaborators: ./ExpressRouterHttpHandler.ts, ../play/ltiPlayRoutes.ts, ../deepLinking/deepLinkRoutes.ts.
 * Tests: apps/server/test/lti/http/ltiPageHeaders.test.ts
 */
import { createHash } from 'node:crypto';
import type { Response } from 'express';

/**
 * The `frame-ancestors` directive for LTI pages.
 * @param canvasOrigins - `CANVAS_ORIGINS`.
 * @returns e.g. `frame-ancestors https://hvl.instructure.com`.
 */
export const frameAncestors = (canvasOrigins: readonly string[]): string =>
  `frame-ancestors ${canvasOrigins.length > 0 ? canvasOrigins.join(' ') : "'none'"}`;

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
 * @param canvasOrigins - `CANVAS_ORIGINS`.
 * @param extra - Further directives, e.g. `form-action` for a Deep Linking return URL.
 * @returns The header value.
 */
export function ltiPageCsp(canvasOrigins: readonly string[], extra: readonly string[] = []): string {
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
    frameAncestors(canvasOrigins),
  ].join('; ');
}

/**
 * The CSP for the H5P player inside Canvas. H5P renders with inline scripts and some content types write their own
 * frames, so the script policy waits for S4's CSP work (D-058); here only framing, `<base>`, plugins and form
 * targets are restricted.
 * @param canvasOrigins - `CANVAS_ORIGINS`.
 * @returns The header value.
 */
export const ltiPlayerCsp = (canvasOrigins: readonly string[]): string =>
  ["base-uri 'none'", "object-src 'none'", "form-action 'self'", frameAncestors(canvasOrigins)].join('; ');

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
