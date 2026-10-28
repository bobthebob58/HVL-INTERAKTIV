/**
 * studioPrincipal — the sign-in check of the studio's signed-in areas: a portal author, that is, a person signed in
 * with Feide (not through a Canvas launch) who may author.
 *
 * Why: the pattern, learning-design, collaboration and mappe areas are portal routes (`auth: 'portal'`, D-089), and
 *      the Canvas side of the studio waits for S6 (D-098). The authentication middleware accepts an ltik on every
 *      `/api` route, so `requirePrincipal` alone would let an LTI principal in; one check keeps the four areas'
 *      answers the same.
 * Spec: AUTH-003, PED-030, PROD-001, PROD-007, MAPPE-001
 * Invariants:
 *   - Signed out, or signed in through an LTI launch: 401 `hvl:unauthenticated`, the answer every signed-in route
 *     documents. An ltik is not a credential of a portal route; the OpenAPI document lists only the portal session.
 *   - Signed in on the portal without an author role (a learner): 403 `error.forbidden`, as `PUT /api/me/notices`.
 *   - A student author passes; an area that refuses student authors (D-090, D-091) checks `studentAuthor` itself.
 *   - The CSRF token of an unsafe method is checked before, by the authentication middleware.
 * Collaborators: ../../auth/principalLocals.ts, ../../auth/Principal.ts, ../../http/authErrors.ts,
 *   ./patternRoutes.ts, ./learningDesignRoutes.ts, ./collaborationRoutes.ts, ./mappeRoutes.ts.
 * Tests: apps/server/test/learningDesign/http/studioPrincipal.test.ts
 */
import type { Response } from 'express';
import { canAuthor, type Principal } from '../../auth/Principal.js';
import { requirePrincipal } from '../../auth/principalLocals.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';

/** A principal signed in on the portal (with Feide). */
export type PortalPrincipal = Principal & { readonly mode: 'portal' };

/**
 * The principal of a portal-only studio route: a person signed in with Feide who may author.
 * @param res - The response, with the principal the authentication middleware set.
 * @returns The principal.
 * @throws HttpError 401 `hvl:unauthenticated` when nobody is signed in or the request came with an ltik, and 403
 *   `error.forbidden` for a portal learner.
 * @spec AUTH-003
 */
export function requirePortalAuthor(res: Response): PortalPrincipal {
  const principal = requirePrincipal(res);
  // SECURITY: the Canvas side of the studio waits for S6 (D-098); an LTI principal is not signed in to the portal.
  if (principal.mode !== 'portal') throw authError('hvl:unauthenticated');
  if (!canAuthor(principal)) throw new HttpError(403, 'error.forbidden');
  return principal as PortalPrincipal;
}
