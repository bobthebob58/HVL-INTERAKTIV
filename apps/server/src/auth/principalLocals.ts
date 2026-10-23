/**
 * principalLocals — where the authenticated principal lives on a request, and how API routes require it.
 *
 * Why: portal sessions and LTI launches both end in one `Principal` (spec 02 §2). Only the authentication
 *      middleware puts it on `res.locals`; every API route reads it from there, so no route trusts request data
 *      for identity.
 * Spec: AUTH-003, LTI-003
 * Invariants:
 *   - `setPrincipal` is called only by the authentication middleware (./requestPrincipal.ts).
 *   - `requirePrincipal` answers 401 `hvl:unauthenticated` when nobody is signed in.
 * Collaborators: ./requestPrincipal.ts, ../http/api/contentSharingRoutes.ts, ../http/h5pLocals.ts.
 * Tests: apps/server/test/http/api/contentSharingRoutes.int.test.ts
 */
import type { Response } from 'express';
import { authError } from '../http/authErrors.js';
import type { Principal } from './Principal.js';

/**
 * Stores the authenticated principal on the response.
 * @param res - The response.
 * @param principal - Who is making the request.
 */
export function setPrincipal(res: Response, principal: Principal): void {
  res.locals.principal = principal;
}

/**
 * The authenticated principal, if any.
 * @param res - The response.
 * @returns The principal, or undefined.
 */
export const principalOf = (res: Response): Principal | undefined =>
  res.locals.principal as Principal | undefined;

/**
 * The authenticated principal of a request.
 * @param res - The response.
 * @returns The principal.
 * @throws HttpError 401 `hvl:unauthenticated` when nobody is signed in.
 */
export function requirePrincipal(res: Response): Principal {
  const principal = principalOf(res);
  if (!principal) throw authError('hvl:unauthenticated');
  return principal;
}
