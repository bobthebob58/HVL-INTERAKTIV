/**
 * returnTo — turns an untrusted "where to go after login" value into a path on this site, or `/`.
 *
 * Why: a portal page without a session sends the browser to Feide login and back again (D-066, PROD-004). The
 *      target arrives in a query string anyone can craft, so an unchecked value would make the login an open
 *      redirect to a phishing site, or into a `javascript:` URL (AUTH-003).
 * Spec: AUTH-003, PROD-004
 * Invariants:
 *   - The result is `/` or a path on this origin: it starts with exactly one `/`, carries the query but never a
 *     fragment, and is at most MAX_RETURN_TO_LENGTH characters.
 *   - Refused (→ `/`): non-strings; absolute URLs and every scheme (`https:`, `javascript:`, `data:` …);
 *     protocol-relative `//host` and `/\host`; any backslash or control character; anything over the length
 *     limit; and the same tricks percent-encoded (once or several times) or produced by dot segments. A value
 *     that cannot be fully percent-decoded within three rounds (e.g. `?q=50%25`, which decodes to a bare `%`)
 *     is refused too: fail closed rather than guess.
 *   - The returned path is the URL parser's own serialisation, so what we checked is what the browser follows.
 * Collaborators: ./feide/feideLoginRoutes.ts, ./feide/loginTransactions.ts, ../http/routes/playerRoutes.ts.
 * Tests: apps/server/test/auth/returnTo.test.ts
 */

/** The longest return path accepted, before and after normalisation. */
export const MAX_RETURN_TO_LENGTH = 2048;

/** Where to go when the value is refused. */
export const DEFAULT_RETURN_TO = '/';

/** How many rounds of percent-decoding are inspected before a value is refused as too deeply encoded. */
const MAX_DECODE_ROUNDS = 3;

/** A placeholder origin to resolve the path against; `.invalid` can never be a real host. */
const PLACEHOLDER_ORIGIN = 'http://return-to.invalid';

const BACKSLASH_OR_CONTROL = /[\\\p{Cc}]/u;

/** A path that does not start with exactly one `/`, or that holds a backslash or control character. */
const isUnsafePath = (path: string): boolean =>
  !path.startsWith('/') || path.startsWith('//') || BACKSLASH_OR_CONTROL.test(path);

/** True when every percent-decoded form of `path` is still a safe local path. */
function decodesToSafePaths(path: string): boolean {
  let current = path;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return false;
    }
    if (decoded === current) return true;
    // SECURITY: `/%2F%2Fevil.example` or `/%5Cevil.example` is harmless to a browser but becomes an open redirect
    // as soon as any later step decodes it, so the decoded forms must pass the same checks.
    if (isUnsafePath(decoded)) return false;
    current = decoded;
  }
  return false;
}

/**
 * Checks a return target and reduces it to a local path (AUTH-003, D-066).
 * @param raw - The untrusted value, e.g. the `returnTo` query parameter.
 * @returns The local path with its query, or `/` when the value is not acceptable.
 * @spec AUTH-003
 */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > MAX_RETURN_TO_LENGTH) return DEFAULT_RETURN_TO;
  if (isUnsafePath(raw) || !decodesToSafePaths(raw)) return DEFAULT_RETURN_TO;
  const url = new URL(raw, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN) return DEFAULT_RETURN_TO;
  // WHY: the fragment is dropped; it belongs to the page the browser shows, not to the target the server stores.
  const local = `${url.pathname}${url.search}`;
  // SECURITY: dot segments can turn `/..//evil.example` into the path `//evil.example`, so the result is checked too.
  if (local.length > MAX_RETURN_TO_LENGTH || isUnsafePath(local) || !decodesToSafePaths(local)) {
    return DEFAULT_RETURN_TO;
  }
  return local;
}
