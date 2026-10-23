/**
 * webPageCsp — the Content Security Policy of the Next.js pages, with a fresh nonce per response.
 *
 * Why: Next.js App Router pages always contain inline scripts, so they can run under a strict policy only with a
 *      per-request nonce, which Next.js reads from the request's `content-security-policy` header and puts on
 *      every script it writes (D-070). Everything else is first-party only (DATA-011).
 * Spec: DATA-011, H5P-009, UD-030
 * Invariants:
 *   - `script-src` never contains `'unsafe-inline'`; `'unsafe-eval'` only in development (React's dev tools need it).
 *   - Inline styles only in development (the dev server injects them); production styles are files or nonced.
 *   - No outside origin: the web pages frame only our own H5P pages.
 * Collaborators: ./webRoutes.ts, ../http/h5pPageCsp.ts (the H5P pages' own policy).
 * Tests: apps/server/test/web/webPageCsp.test.ts
 */
import { randomBytes } from 'node:crypto';

/** What the policy depends on. */
export interface WebPageCspOptions {
  /** The response's nonce (base64). */
  readonly nonce: string;
  /** Whether Next.js runs its development server. */
  readonly dev: boolean;
  /** Who may frame the page: `'self'` for portal pages, plus `CANVAS_ORIGINS` for `/app/*`. */
  readonly frameAncestors: readonly string[];
}

/**
 * A fresh nonce: 128 random bits, base64.
 * @returns The nonce.
 */
export const createNonce = (): string => randomBytes(16).toString('base64');

/**
 * Builds the policy.
 * @param options - Nonce, mode and framing.
 * @returns The header value.
 */
export function webPageCsp(options: WebPageCspOptions): string {
  const nonce = `'nonce-${options.nonce}'`;
  return [
    "default-src 'none'",
    `script-src 'self' ${nonce}${options.dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${options.dev ? "'unsafe-inline'" : nonce}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${options.frameAncestors.length > 0 ? options.frameAncestors.join(' ') : "'none'"}`,
  ].join('; ');
}
