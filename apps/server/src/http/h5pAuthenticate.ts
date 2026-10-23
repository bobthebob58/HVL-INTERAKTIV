/**
 * h5pAuthenticate — the `authenticate` middleware the H5P router takes (S2, ./h5pLocals.ts): turns the request's
 * `Principal` into the H5P actor, with the request's token for H5P's URLs.
 *
 * Why: S2 built the H5P routes behind a pluggable authenticator; S3 supplies the real one. Every H5P route reads
 *      the actor from `res.locals.h5pActor`, which only this middleware sets, from the principal that
 *      ../auth/requestPrincipal.ts resolved (D-053, D-058).
 * Spec: H5P-007, H5P-006, LTI-003, AUTH-003
 * Invariants:
 *   - No principal → no actor; the routes then answer 401, and an expired portal session says so, except that a
 *     player page sends the browser to Feide login instead (PROD-004).
 *   - The actor's `urlToken` is the token this request authenticated with (ltik or CSRF), nothing else.
 * Collaborators: ../auth/requestPrincipal.ts, ../auth/principalToH5pActor.ts, ./createH5pRouter.ts.
 * Tests: apps/server/test/http/h5pAuthenticate.int.test.ts
 */
import type { NextFunction, Request, Response } from 'express';
import { principalOf } from '../auth/principalLocals.js';
import { principalToH5pActor } from '../auth/principalToH5pActor.js';
import { urlTokenOf } from '../auth/requestPrincipal.js';
import { hadStaleSessionCookie } from '../auth/session/portalSessionMiddleware.js';
import { authError } from './authErrors.js';
import type { Authenticate } from './h5pLocals.js';

// WHY: opening a player page without a session goes to Feide login (./routes/playerRoutes.ts), not to a 401.
const isPlayerNavigation = (req: Request): boolean => req.method === 'GET' && req.path.startsWith('/play/');

/**
 * The H5P router's authenticator.
 * @returns Middleware that sets `res.locals.h5pActor` from the principal.
 */
export function h5pAuthenticate(): Authenticate {
  return (req: Request, res: Response, next: NextFunction): void => {
    const principal = principalOf(res);
    if (principal) {
      res.locals.h5pActor = principalToH5pActor(principal, urlTokenOf(res));
    } else if (hadStaleSessionCookie(res) && !isPlayerNavigation(req)) {
      // WHY: say why the request is refused, so the page can ask the person to log in again (AUTH-003).
      throw authError('hvl:session-expired');
    }
    next();
  };
}
