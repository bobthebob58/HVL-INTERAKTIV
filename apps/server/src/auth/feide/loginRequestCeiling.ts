/**
 * loginRequestCeiling — the ceiling on how many requests one network address may send to the Feide login routes
 * (`/auth/feide/login`, `/auth/feide/callback`) in a minute.
 *
 * Why: both routes answer before anyone is signed in. Starting a login stores a pending login in Redis and may
 *      fetch Feide's settings; a callback reads Redis and, when it is refused, can write to the audit log. Without
 *      a ceiling, an address that sends requests without end chooses how much of that the server does (D-150). The
 *      counting, the fingerprint and the refusal are the shared ceiling's (../../http/addressRequestCeiling.ts);
 *      this file holds the group, its number and its page.
 * Spec: AUTH-001, NFR-006
 * Invariants:
 *   - The number is far above real use: a login is two requests, and a whole campus behind one address logs in a
 *     few hundred times a minute at most, when a lecture starts.
 *   - Past the ceiling: 429 with `Retry-After`, as the portal's friendly page, before a login is stored or used.
 *   - Login and callback share one count per address.
 * Collaborators: ./feideLoginRoutes.ts (runs it ahead of both routes), ../../server/feideLoginWiring.ts,
 *   ../../http/addressRequestCeiling.ts (the counter and the privacy rule), ../../http/pages/portalPages.ts.
 * Tests: apps/server/test/auth/feide/feideLoginCeiling.int.test.ts
 */
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import { addressRequestCeiling, type AddressRequestCeilingDeps } from '../../http/addressRequestCeiling.js';
import { sendPortalError } from '../../http/pages/portalPages.js';

/** Requests one address may send to the Feide login routes in a minute: 2 000 logins of two requests each. */
export const FEIDE_LOGIN_REQUESTS_PER_MINUTE = 4000;

/** What the ceiling needs. */
export interface LoginRequestCeilingDeps extends AddressRequestCeilingDeps {
  /** Where a refusal is logged, as the routes' other refusals are. */
  readonly logger: Logger;
  /** `FEIDE_LOGIN_REQUESTS_PER_MINUTE` unless a test lowers it. */
  readonly limit?: number;
}

/**
 * Builds the middleware that counts a request to a Feide login route and refuses it past the ceiling.
 * @param deps - Redis, the hasher, the logger and, for tests, a lower limit.
 * @returns An Express middleware to run ahead of the login and callback routes.
 * @spec AUTH-001
 */
export function feideLoginRequestCeiling(deps: LoginRequestCeilingDeps): RequestHandler {
  return addressRequestCeiling(deps, {
    keyPrefix: 'hvli:feide-requests:',
    limit: deps.limit ?? FEIDE_LOGIN_REQUESTS_PER_MINUTE,
    name: 'Feide login ceiling',
    refuse: (error, res) => sendPortalError(res, error, deps.logger),
  });
}
