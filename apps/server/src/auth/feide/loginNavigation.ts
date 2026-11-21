/**
 * loginNavigation — what the browser says about a request to the Feide login routes: a page the person opened,
 * a page another site sent the browser to, or no page at all.
 *
 * Why: starting a login replaces the session a browser has, and with Feide's single sign-on it needs no further
 *      step from the person. A request to `/auth/feide/login` that another site made in the background (an
 *      image, a hidden frame, a redirect nobody clicked) therefore changed the session token under the person's
 *      open pages. Browsers say how a request began (fetch metadata), which tells the cases apart (D-131).
 * Spec: AUTH-001, AUTH-003
 * Invariants:
 *   - A browser that sends no fetch metadata is treated as before: every request starts the login.
 *   - A request that is no navigation (`Sec-Fetch-Mode` other than `navigate`) is refused.
 *   - A navigation starts the login when it is a whole page (`Sec-Fetch-Dest: document`) that began on our own
 *     origin, in the address bar or a bookmark (`same-origin`, `none`), or with a click by the person
 *     (`Sec-Fetch-User: ?1`), which a link in an e-mail or on another site is.
 *   - Any other navigation (a frame, or a page another site opened without a click) is asked: it gets the sign-in
 *     page, whose button starts the login as a click on our own page.
 * Collaborators: ./feideLoginRoutes.ts.
 * Tests: apps/server/test/auth/feide/loginNavigation.test.ts, apps/server/test/auth/feide/feideLoginStart.int.test.ts
 */
import type { IncomingHttpHeaders } from 'node:http';

/** What to do with a request to `/auth/feide/login`. */
export type LoginStart = 'start' | 'ask' | 'refuse';

const one = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Tells whether a request is a whole page being opened, as far as the browser says.
 * @param headers - The request headers.
 * @returns True for a top-level navigation, and for a browser that sends no fetch metadata.
 * @spec AUTH-001
 */
export function isPageNavigation(headers: IncomingHttpHeaders): boolean {
  if (headers['sec-fetch-site'] === undefined) return true;
  return one(headers['sec-fetch-mode']) === 'navigate' && one(headers['sec-fetch-dest']) === 'document';
}

/**
 * Decides what a request to `/auth/feide/login` gets.
 * @param headers - The request headers.
 * @returns `start` to begin the login, `ask` for the sign-in page with its button, `refuse` for a request that is
 *   no navigation.
 * @spec AUTH-003
 */
export function loginStartOf(headers: IncomingHttpHeaders): LoginStart {
  const site = one(headers['sec-fetch-site']);
  if (headers['sec-fetch-site'] === undefined) return 'start';
  // SECURITY: an image, a script or a background fetch is never a person signing in (D-131).
  if (one(headers['sec-fetch-mode']) !== 'navigate') return 'refuse';
  if (one(headers['sec-fetch-dest']) !== 'document') return 'ask';
  if (site === 'same-origin' || site === 'none') return 'start';
  return one(headers['sec-fetch-user']) === '?1' ? 'start' : 'ask';
}
