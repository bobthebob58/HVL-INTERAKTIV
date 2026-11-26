/**
 * csrfRetry — when the server says the CSRF token a page holds is out of date, asks once for the session's current
 * one, so the request can be sent again.
 *
 * Why: a page keeps the token it read when it opened. The session behind it can be replaced while the page is
 *      open (the same person signs in again in another tab), and every save from the open page then answered
 *      `hvl:csrf-invalid` until a reload. The cookie still names a session of this browser, so the page may ask
 *      for that session's token and try once more (AUTH-003, D-131).
 * Spec: AUTH-003
 * Invariants:
 *   - Asks `GET /auth/session` at most once per refused request; a token that is no newer ends the attempt.
 *   - A fresher token is remembered against the one the page holds, so later requests carry it straight away.
 *   - The token lives in this module's memory only; nothing is written to storage, a cookie or a log.
 *   - Never throws.
 * Collaborators: ./apiRequest.ts (the only caller), apps/server/src/auth/feide/feideLoginRoutes.ts (`/auth/session`).
 * Tests: apps/web/test/api/csrfRetry.test.ts
 */

/** The code the server refuses a request with when its CSRF token is not the session's. */
const CSRF_INVALID = 'hvl:csrf-invalid';

/** The session's newer token, by the token a page still holds. */
const fresher = new Map<string, string>();

/**
 * The token to send for the one a page holds.
 * @param held - The token the page read when it opened.
 * @returns The newer token when one was fetched since, else `held`.
 */
export const currentCsrfToken = (held: string): string => fresher.get(held) ?? held;

/**
 * Tells whether an answer refuses the request for its CSRF token.
 * @param response - The answer; its body stays readable.
 * @returns True for a 401 whose error code is `hvl:csrf-invalid`.
 */
export async function isCsrfRefusal(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body: unknown = await response.clone().json();
    return (body as { errorCode?: unknown } | null)?.errorCode === CSRF_INVALID;
  } catch {
    return false;
  }
}

/**
 * Asks for the session's current token.
 * @param held - The token the page holds, which the server refused.
 * @returns The newer token, or undefined when there is no session or its token is the refused one.
 */
export async function fresherCsrfToken(held: string): Promise<string | undefined> {
  try {
    const response = await fetch('/auth/session', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    const token = ((await response.json()) as { csrfToken?: unknown } | null)?.csrfToken;
    if (typeof token !== 'string' || token === '' || token === currentCsrfToken(held)) return undefined;
    fresher.set(held, token);
    return token;
  } catch {
    return undefined;
  }
}

/** Forgets every remembered token; for tests only, which share this module between cases. */
export function resetCsrfRetryForTests(): void {
  fresher.clear();
}
