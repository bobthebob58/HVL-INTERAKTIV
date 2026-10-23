/**
 * webRequestContract — what Express changes on a request before Next.js sees it.
 *
 * Why: the web app never handles credentials (D-068): all data goes from the browser to the Express API. Removing
 *      cookies, tokens and the `ltik` query here means a bug or a dependency inside Next.js cannot leak or use them,
 *      and Express's own decisions (nonce policy, locale) travel in headers a client cannot forge.
 * Spec: LTI-003, AUTH-003, DATA-009, PROD-012
 * Invariants:
 *   - Removed: `cookie`, `authorization`, `proxy-authorization`, both CSP headers, every `x-hvli-*` and
 *     `x-middleware-*` header, `next-action`, and the `ltik` query parameter (all spellings of the names).
 *   - `rawHeaders` is filtered the same way, so no code path sees a removed header.
 *   - Set afterwards: `content-security-policy` (Next.js takes the nonce from it) and `x-hvli-locale`.
 * Collaborators: ./webRoutes.ts, apps/web/src/i18n/requestLocale.ts (reads `x-hvli-locale`).
 * Tests: apps/server/test/web/webRequestContract.test.ts
 */
import type { IncomingMessage } from 'node:http';
import type { Locale } from '../i18n/translate.js';

/** The request header that carries the locale to the web app (same name in apps/web). */
export const LOCALE_HEADER = 'x-hvli-locale';

const REMOVED = new Set([
  'cookie',
  'authorization',
  'proxy-authorization',
  'content-security-policy',
  'content-security-policy-report-only',
  'next-action',
]);
const REMOVED_PREFIXES = ['x-hvli-', 'x-middleware-'];

const isRemoved = (name: string): boolean => {
  const lower = name.toLowerCase();
  return REMOVED.has(lower) || REMOVED_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

/**
 * The URL without its `ltik` query parameter.
 * @param url - The request URL (path and query).
 * @returns The same URL, minus every `ltik` value.
 */
export function withoutLtik(url: string): string {
  const parsed = new URL(url, 'http://web.invalid');
  if (![...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'ltik')) return url;
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase() === 'ltik') parsed.searchParams.delete(key);
  }
  return `${parsed.pathname}${parsed.search}`;
}

/**
 * Rewrites a request for the web app, in place.
 * @param req - The incoming request, after every Express route has passed it on.
 * @param decisions - The response's policy and the locale Express chose.
 */
export function prepareWebRequest(req: IncomingMessage, decisions: { csp: string; locale: Locale }): void {
  for (const name of Object.keys(req.headers)) if (isRemoved(name)) delete req.headers[name];
  const raw: string[] = [];
  for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
    const [name, value] = [req.rawHeaders[i] ?? '', req.rawHeaders[i + 1] ?? ''];
    if (!isRemoved(name)) raw.push(name, value);
  }
  req.rawHeaders = raw;
  req.url = withoutLtik(req.url ?? '/');
  req.headers['content-security-policy'] = decisions.csp;
  req.headers[LOCALE_HEADER] = decisions.locale;
  req.rawHeaders.push('content-security-policy', decisions.csp, LOCALE_HEADER, decisions.locale);
}
