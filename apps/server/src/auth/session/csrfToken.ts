/**
 * csrfToken — when a portal request needs the session's synchronizer CSRF token, where the token is read from,
 * and the constant-time check.
 *
 * Why: AUTH-003 requires a CSRF token on state-changing requests, and H5P-007 a valid token on every H5P AJAX and
 *      user-data request, whatever its method (D-057). The token comes from the `X-CSRF-Token` header (our pages),
 *      a `csrf` query value (H5P URLs, D-058) or a `csrf` form field (plain HTML forms).
 * Spec: AUTH-003, H5P-007
 * Invariants:
 *   - Only `GET`, `HEAD` and `OPTIONS`, spelled exactly so, are safe; any other method needs the token.
 *   - `/h5p/ajax` and `/h5p/contentUserData` need it for every method, including `GET` and `HEAD` (Express runs
 *     `GET` handlers for `HEAD`). Their match ignores case, repeated or back slashes, trailing segments and
 *     percent-encoding, so no spelling that Express routes there escapes the check.
 *   - Only `req.method` counts. `X-HTTP-Method-Override`, `_method` and similar are never read, here or in routing.
 *   - The first source that is present decides: header, then query, then form field. A repeated, empty or
 *     non-string value there is a refusal, never a fall-through to the next source.
 *   - The comparison hashes both sides and uses `timingSafeEqual`, so neither the content nor the length of the
 *     expected token leaks through timing. Any refusal is `hvl:csrf-invalid` (401).
 * Collaborators: ./SessionStore.ts (makes the token), ../requestPrincipal.ts (calls `assertCsrfWhenRequired`),
 *   ../../h5p/HvlUrlGenerator.ts (puts the token in H5P URLs).
 * Tests: apps/server/test/auth/session/csrfToken.test.ts
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { authError } from '../../http/authErrors.js';

/** The request header our pages send the token in. */
export const CSRF_HEADER = 'x-csrf-token';
/** The query parameter and form field name of the token. */
export const CSRF_PARAM = 'csrf';
/** Paths that need the token for every method (H5P-007). Frozen: the pattern below is built from it once. */
export const CSRF_ALWAYS_PATHS: readonly string[] = Object.freeze(['/h5p/ajax', '/h5p/contentUserData']);

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALWAYS_PATTERN = new RegExp(
  `/(?:${CSRF_ALWAYS_PATHS.map((path) => path.slice(1).toLowerCase()).join('|')})(?![a-z0-9_-])`,
);

const comparable = (path: string): string =>
  path
    .toLowerCase()
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/');

/** Whether a raw request target could route to one of `CSRF_ALWAYS_PATHS`. */
function mayRouteToAlwaysPath(target: string): boolean {
  // WHY: an absolute-form target (`GET http://host/h5p/ajax`) routes by its path, so the whole target is searched.
  const beforeQuery = target.split('?', 1)[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(beforeQuery);
  } catch {
    // SECURITY: a target that cannot be decoded cannot be shown to avoid the protected paths, so it needs the token.
    return true;
  }
  return [beforeQuery, decoded].some((path) => ALWAYS_PATTERN.test(comparable(path)));
}

/**
 * Tells whether a portal request needs the CSRF token.
 * @param method - `req.method`, exactly as received.
 * @param target - The full request target from the origin root (`req.originalUrl`), not a path inside a mount.
 * @returns True for unsafe methods, and for any method on `/h5p/ajax` and `/h5p/contentUserData`.
 * @spec AUTH-003
 */
export function csrfRequired(method: string, target: string): boolean {
  // SECURITY: an exact, case-sensitive allow-list of safe methods; anything else (including `get`) needs the token.
  if (!SAFE_METHODS.has(method)) return true;
  // SECURITY: Express routes HEAD to GET handlers, and H5P's AJAX GETs act on the server, so these paths need the
  // token for every method; being stricter than routing here only ever asks for the token more often.
  return mayRouteToAlwaysPath(target);
}

const singleValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const hasField = (container: unknown): container is Record<string, unknown> =>
  typeof container === 'object' && container !== null && Object.hasOwn(container, CSRF_PARAM);

/**
 * The CSRF token a request presents.
 * @param req - The request; a urlencoded body is read only if a parser already ran.
 * @returns The header value, else the `csrf` query value, else the `csrf` form field; undefined when none is
 *   present or the deciding value is repeated, empty or not a string.
 */
export function presentedCsrfToken(req: Request): string | undefined {
  const header = req.headers[CSRF_HEADER];
  if (header !== undefined) return singleValue(header);
  const query: unknown = req.query;
  if (hasField(query)) return singleValue(query[CSRF_PARAM]);
  const body: unknown = req.body;
  if (hasField(body) && req.is('application/x-www-form-urlencoded')) return singleValue(body[CSRF_PARAM]);
  return undefined;
}

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Refuses a request whose CSRF token is missing or not the session's.
 * @param req - The request.
 * @param session - The portal session (its `csrfToken`).
 * @throws HttpError 401 `hvl:csrf-invalid` when the token is missing, malformed or wrong.
 * @spec AUTH-003
 */
export function assertCsrf(req: Request, session: { readonly csrfToken: string }): void {
  const presented = presentedCsrfToken(req);
  const expected = session.csrfToken;
  // SECURITY: comparing SHA-256 digests keeps the comparison constant-time even when the lengths differ.
  if (presented === undefined || expected === '' || !timingSafeEqual(digest(presented), digest(expected))) {
    throw authError('hvl:csrf-invalid');
  }
}

/**
 * Checks the CSRF token when the request needs one (`csrfRequired` on `req.method` and `req.originalUrl`).
 * @param req - The request of a portal principal.
 * @param session - The portal session.
 * @throws HttpError 401 `hvl:csrf-invalid` when the token is needed and missing or wrong.
 * @spec H5P-007
 */
export function assertCsrfWhenRequired(req: Request, session: { readonly csrfToken: string }): void {
  if (csrfRequired(req.method, req.originalUrl)) assertCsrf(req, session);
}
