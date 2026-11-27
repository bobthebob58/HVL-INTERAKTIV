/**
 * launchRequestCeiling — the ceiling on how many requests one network address may send to ltijs's routes (login,
 * launch, key set) in a minute.
 *
 * Why: these routes answer before anyone is signed in. A login request makes the server store a nonce and sign
 *      two tokens, and a launch reads the database and checks signatures, so an address that sends requests
 *      without end chooses how much work the server does (D-141). The counting, the fingerprint and the refusal
 *      are the shared ceiling's (../../http/addressRequestCeiling.ts); this file holds the group and its number.
 * Spec: LTI-001, NFR-006
 * Invariants:
 *   - The number is far above real use: a launch is three requests, and a whole campus behind one address
 *     launches hundreds of times a minute at most.
 *   - Past the ceiling: 429 `hvl:rate-limited` with `Retry-After`, as an LTI error page, before the body is read.
 * Collaborators: ./ExpressRouterHttpHandler.ts (runs it ahead of every ltijs route), ../LtiProviderFactory.ts,
 *   ../../http/addressRequestCeiling.ts (the counter and the privacy rule), ./ltiErrorPages.ts (the page).
 * Tests: apps/server/test/lti/http/launchRequestCeiling.int.test.ts
 */
import type { RequestHandler } from 'express';
import { addressRequestCeiling, type AddressRequestCeilingDeps } from '../../http/addressRequestCeiling.js';

/** Requests one address may send to ltijs's routes in a minute: 2 000 launches of three requests each. */
export const LAUNCH_REQUESTS_PER_MINUTE = 6000;

/** What the ceiling needs. */
export interface LaunchRequestCeilingDeps extends AddressRequestCeilingDeps {
  /** `LAUNCH_REQUESTS_PER_MINUTE` unless a test lowers it. */
  readonly limit?: number;
}

/**
 * Builds the middleware that counts a request to an ltijs route and refuses it past the ceiling.
 * @param deps - Redis, the hasher, the logger and, for tests, a lower limit.
 * @returns An Express middleware to run before the body parser.
 * @spec LTI-001
 */
export function launchRequestCeiling(deps: LaunchRequestCeilingDeps): RequestHandler {
  return addressRequestCeiling(deps, {
    keyPrefix: 'hvli:lti-requests:',
    limit: deps.limit ?? LAUNCH_REQUESTS_PER_MINUTE,
    name: 'LTI request ceiling',
  });
}
