/**
 * sessionCookies — the portal's two cookies (session and login transaction): names, exact attributes, a strict
 * Cookie-header parser, and a Set-Cookie writer that never sends two values for one cookie.
 *
 * Why: AUTH-003 fixes the session cookie as `__Host-hvli_sid` with `HttpOnly`, `Secure`, `SameSite=Lax` and
 *      `Path=/`, and D-057 adds a single-use login-transaction cookie for 10 minutes. We use no cookie-parser or
 *      express-session, so the exact attributes and the parsing rules live here.
 * Spec: AUTH-003, AUTH-001
 * Invariants:
 *   - Both cookies use the `__Host-` prefix: `Secure`, `Path=/` and no `Domain`, so a sibling subdomain cannot set
 *     or overwrite them, and they are never sent to another host.
 *   - The session cookie has no `Max-Age`/`Expires`; the login cookie has `Max-Age=600`; clearing uses `Max-Age=0`
 *     with the same attributes.
 *   - Only opaque IDs (43 base64url characters) are written, so a value can never inject attributes.
 *   - The parser never URL-decodes. A name is returned only when it occurs exactly once with a well-formed value;
 *     a duplicated name is dropped entirely. Malformed pairs are ignored.
 * Collaborators: ./portalSessionMiddleware.ts, ./opaqueIds.ts, ../feide/loginTransactions.ts,
 *   ../feide/feideLoginRoutes.ts.
 * Tests: apps/server/test/auth/session/sessionCookies.test.ts
 */
import type { Request, Response } from 'express';
import { isOpaqueId } from './opaqueIds.js';

/** The portal session cookie (AUTH-003). */
export const SESSION_COOKIE = '__Host-hvli_sid';
/** The login-transaction cookie that binds a Feide login to this browser (D-057). */
export const LOGIN_COOKIE = '__Host-hvli_login';
/** Lifetime of the login cookie, the same as the login transaction's. */
export const LOGIN_COOKIE_MAX_AGE_SECONDS = 600;

// WHY: Lax, not Strict: Feide's callback and links from Canvas or e-mail are cross-site top-level navigations, and a
// Strict cookie would be missing on them. Lax still withholds the cookies from cross-site POSTs, frames and fetches.
const ATTRIBUTES = 'Path=/; Secure; HttpOnly; SameSite=Lax';

const serialise = (name: string, value: string, maxAge?: number): string => {
  // SECURITY: only our own random IDs are written, so a value can never add attributes or headers.
  if (!isOpaqueId(value)) throw new TypeError(`${name} takes an opaque ID`);
  return maxAge === undefined
    ? `${name}=${value}; ${ATTRIBUTES}`
    : `${name}=${value}; Max-Age=${maxAge}; ${ATTRIBUTES}`;
};

/**
 * The Set-Cookie value for a session.
 * @param sid - The session ID.
 * @returns e.g. `__Host-hvli_sid=<sid>; Path=/; Secure; HttpOnly; SameSite=Lax`.
 * @throws TypeError when `sid` is not an opaque ID.
 */
export const sessionCookie = (sid: string): string =>
  // WHY: no Max-Age, so the cookie goes when the browser closes (shared PCs in labs and libraries). The server
  // enforces 2 h idle and 12 h absolute anyway, and a cookie lifetime that sliding never renews would only mislead.
  serialise(SESSION_COOKIE, sid);

/**
 * The Set-Cookie value that removes the session cookie.
 * @returns `__Host-hvli_sid=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`.
 */
export const expiredSessionCookie = (): string => `${SESSION_COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;

/**
 * The Set-Cookie value for a login transaction.
 * @param txId - The transaction ID.
 * @returns e.g. `__Host-hvli_login=<txId>; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax`.
 * @throws TypeError when `txId` is not an opaque ID.
 */
export const loginCookie = (txId: string): string =>
  serialise(LOGIN_COOKIE, txId, LOGIN_COOKIE_MAX_AGE_SECONDS);

/**
 * The Set-Cookie value that removes the login cookie.
 * @returns `__Host-hvli_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`.
 */
export const expiredLoginCookie = (): string => `${LOGIN_COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;

// RFC 9110 token (cookie-name) and RFC 6265 cookie-octet; no quotes, spaces, commas, semicolons or backslashes.
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_VALUE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;

/**
 * Parses a Cookie request header strictly.
 * @param header - `req.headers.cookie`.
 * @returns Each name that occurs exactly once with a well-formed value. Values are not decoded.
 */
export function parseCookieHeader(
  header: string | readonly string[] | undefined,
): ReadonlyMap<string, string> {
  const text = typeof header === 'string' ? header : (header ?? []).join('; ');
  const seen = new Map<string, string | null>();
  for (const pair of text.split(';')) {
    const trimmed = pair.trim();
    const equals = trimmed.indexOf('=');
    // WHY: a pair without a name (`value` or `=value`) cannot be attributed to any cookie, so it is skipped.
    if (equals <= 0) continue;
    const name = trimmed.slice(0, equals);
    const value = trimmed.slice(equals + 1);
    if (!COOKIE_NAME.test(name)) continue;
    // SECURITY: browsers send the more specific (path) or older cookie first, so neither "first wins" nor "last
    // wins" is safe against cookie tossing or a parser that disagrees with ours; a name that occurs twice, or with a
    // malformed value, is ambiguous and dropped. A forced logout is the worst outcome, never a fixed session.
    seen.set(name, seen.has(name) || !COOKIE_VALUE.test(value) ? null : value);
  }
  const cookies = new Map<string, string>();
  for (const [name, value] of seen) if (value !== null) cookies.set(name, value);
  return cookies;
}

/**
 * Reads one cookie of a request.
 * @param req - The request.
 * @param name - The cookie name, e.g. `SESSION_COOKIE`.
 * @returns The raw value, or undefined when it is missing, duplicated or malformed.
 */
export const readCookie = (req: Pick<Request, 'headers'>, name: string): string | undefined =>
  parseCookieHeader(req.headers.cookie).get(name);

/**
 * Adds a Set-Cookie header, replacing any earlier one for the same cookie on this response.
 * @param res - The response; its headers must not have been sent.
 * @param cookie - A value from `sessionCookie`, `expiredSessionCookie`, `loginCookie` or `expiredLoginCookie`.
 * @throws TypeError when `cookie` does not start with a cookie name and `=`.
 */
export function setCookie(res: Response, cookie: string): void {
  const equals = cookie.indexOf('=');
  // WHY: without a name the prefix would be empty and match, and so remove, every other cookie on the response.
  if (equals <= 0 || !COOKIE_NAME.test(cookie.slice(0, equals)))
    throw new TypeError('not a Set-Cookie value');
  const prefix = cookie.slice(0, equals + 1);
  const existing = res.getHeader('Set-Cookie');
  const earlier = existing === undefined ? [] : Array.isArray(existing) ? existing : [String(existing)];
  // WHY: a response that first clears a stale cookie and then starts a session must not carry both values.
  res.setHeader('Set-Cookie', [...earlier.filter((value) => !value.startsWith(prefix)), cookie]);
}
