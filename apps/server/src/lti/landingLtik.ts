/**
 * landingLtik — reads the ltik from the address of a page a launch lands on, and accepts it only when the browser
 * came there from our own pages, or just after the launch.
 *
 * Why: a launch ends with a redirect to `/app/play`, `/lti/play` or `/lti/deeplink` with the ltik in the address,
 *      and our chrome page frames `/lti/play` and `/lti/edit` the same way (LTI-003, D-069). An address like that
 *      was accepted from anywhere for the ltik's whole day: a link carrying someone's own ltik put whoever
 *      followed it into that person's launch. A genuine landing never comes from elsewhere: ltijs processes a
 *      launch only on its own second, same-origin POST, and the frames are ours (D-130).
 * Spec: LTI-003
 * Invariants:
 *   - `Sec-Fetch-Site` present and not `same-origin` (another site, the same site but another origin, a typed or
 *     bookmarked address): refused before the ltik is looked at.
 *   - No `Sec-Fetch-Site` (a browser that sends no fetch metadata): accepted only within `LANDING_WINDOW_MS` of
 *     the ltik's issue time; an ltik without an issue time is refused.
 *   - Every refusal is `hvl:ltik-invalid`, the «open it again from Canvas» page, so the cause is not told.
 *   - Only the address-borne ltik of these pages is judged here; the ltik as `Authorization: Bearer` and in H5P's
 *     own URLs is ../auth/requestPrincipal.ts's.
 * Collaborators: ./play/appLaunchRoutes.ts, ./play/ltiPlayRoutes.ts, ./play/ltiEditRoutes.ts,
 *   ./deepLinking/deepLinkRoutes.ts, ./ltikPrincipal.ts, ../http/authErrors.ts.
 * Tests: apps/server/test/lti/landingLtik.test.ts, apps/server/test/lti/landingLtik.int.test.ts
 */
import type { Request } from 'express';
import { authError } from '../http/authErrors.js';
import type { ResolvedLtik } from './ltikPrincipal.js';

/** How long after its issue an ltik is accepted in an address from a browser that sends no fetch metadata. */
export const LANDING_WINDOW_MS = 10 * 60_000;

/** The issue time (`iat`) of a JWT whose signature the resolver has already checked, in milliseconds. */
function issuedAtOf(ltik: string): number | undefined {
  try {
    const payload: unknown = JSON.parse(Buffer.from(ltik.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const iat = (payload as { iat?: unknown } | null)?.iat;
    return typeof iat === 'number' && Number.isFinite(iat) ? iat * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads and resolves the ltik of a landing page's address.
 * @param req - The page request (its `ltik` query value and its `Sec-Fetch-Site` header).
 * @param resolveLtik - Resolves an ltik into its launch (./ltikPrincipal.ts).
 * @param now - The clock; tests pass a fixed one.
 * @returns The resolved launch and the ltik.
 * @throws HttpError 401 `hvl:ltik-invalid` for a missing or invalid ltik, an address that did not come from our
 *   own pages, and an address without fetch metadata outside the landing window.
 * @spec LTI-003
 */
export async function landingLtik(
  req: Pick<Request, 'query' | 'headers'>,
  resolveLtik: (ltik: string) => Promise<ResolvedLtik>,
  now: () => Date = () => new Date(),
): Promise<ResolvedLtik & { readonly ltik: string }> {
  const ltik = typeof req.query.ltik === 'string' ? req.query.ltik : '';
  if (ltik === '') throw authError('hvl:ltik-invalid');
  const site = req.headers['sec-fetch-site'];
  // SECURITY: the browser says where the navigation began; a landing that began anywhere but our pages is not one.
  if (site !== undefined && site !== 'same-origin') throw authError('hvl:ltik-invalid');
  const resolved = await resolveLtik(ltik);
  if (site === undefined) {
    // SECURITY: without fetch metadata the address is taken only while the launch is fresh (D-130).
    const issuedAt = issuedAtOf(ltik);
    if (issuedAt === undefined || now().getTime() - issuedAt > LANDING_WINDOW_MS)
      throw authError('hvl:ltik-invalid');
  }
  return { ...resolved, ltik };
}
