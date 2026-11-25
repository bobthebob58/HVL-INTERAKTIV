/**
 * launchPostOrigin — accepts the last step of an LTI launch only from our own page.
 *
 * Why: a launch reaches us twice. Canvas posts the ID token to `/lti/launch`; ltijs answers with a page that
 *      reads the launch's recovery token from the browser that began the login and posts everything again with
 *      it (`ltijs_recovered_state`), and only that second post is processed. What ties a launch to the browser
 *      that began it is that this second post comes from our page. ltijs checks it by `Sec-Fetch-Site`, and
 *      lets a request through when the header is missing, as it is in browsers older than Safari 16.4 and
 *      Firefox 90. In those browsers another site could post a launch of its own choosing, recovery token
 *      included, and the person would land inside that launch (D-141).
 * Spec: LTI-001, LTI-003
 * Invariants:
 *   - A post that carries `ltijs_recovered_state` as text is the last step; every other post to the launch route
 *     is Canvas's own (cross-site by nature) and is not judged here.
 *   - With `Sec-Fetch-Site`: the value must be `same-origin`.
 *   - Without it: `Origin` must be one header whose value is our own origin, exactly. A missing `Origin`, `null`
 *     and any other origin are refused. ltijs's launch page is sent with `Referrer-Policy: same-origin` so that
 *     a browser names our origin there (./ltiPageHeaders.ts); under `no-referrer` it would send `null`.
 *   - A refusal is ltijs's own `INVALID_STATE`, so the page and the audit reason are the ones a launch with a
 *     wrong recovery token gets (./ltiErrorPages.ts).
 * Collaborators: ./ExpressRouterHttpHandler.ts (calls it before ltijs reads the request), ./ltiPageHeaders.ts,
 *   ./ltiErrorPages.ts.
 * Tests: apps/server/test/lti/http/launchPostOrigin.test.ts, apps/server/test/lti/launchBrowserBinding.int.test.ts
 */
import { LtijsError } from 'ltijs';

/** The form field ltijs's launch page adds when it posts a launch the second time. */
export const RECOVERED_STATE_FIELD = 'ltijs_recovered_state';

/** Request headers as Express gives them: lower-case names. */
export type LaunchRequestHeaders = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * Tells whether a post to the launch route is the last step of a launch.
 * @param body - The parsed form body.
 * @returns True when the post carries a recovery token, as only ltijs's own launch page sends it.
 */
export function isLastLaunchStep(body: Readonly<Record<string, unknown>>): boolean {
  // WHY: the same test as ltijs makes (`resolveRecoveredState`), so both agree on which post is processed.
  return typeof body[RECOVERED_STATE_FIELD] === 'string';
}

/**
 * Tells whether a request's headers say it was made by a page of our own origin.
 * @param headers - The request headers, lower-case names.
 * @param ownOrigin - Our own origin, e.g. `https://interaktiv.hvl.no`.
 * @returns True for `Sec-Fetch-Site: same-origin`, or, without that header, an `Origin` that is ours.
 */
export function isFromOwnPage(headers: LaunchRequestHeaders, ownOrigin: string): boolean {
  const site = headers['sec-fetch-site'];
  if (site !== undefined) return site === 'same-origin';
  // SECURITY: an exact match of one value; `null`, a list and a missing header are all "not ours".
  return headers.origin === ownOrigin;
}

/**
 * Refuses the last step of a launch that our own page did not send.
 * @param body - The parsed form body of a post to the launch route.
 * @param headers - The request headers, lower-case names.
 * @param ownOrigin - Our own origin.
 * @throws LtijsError `INVALID_STATE` for a last step from anywhere but our own page.
 * @spec LTI-001
 */
export function assertLastStepFromOwnPage(
  body: Readonly<Record<string, unknown>>,
  headers: LaunchRequestHeaders,
  ownOrigin: string,
): void {
  if (isLastLaunchStep(body) && !isFromOwnPage(headers, ownOrigin)) throw new LtijsError('INVALID_STATE');
}
