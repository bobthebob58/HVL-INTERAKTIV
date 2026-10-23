/**
 * h5pLocals — where the authenticated actor lives on a request, and how routes require it.
 *
 * Why: S2 ships no authentication of its own (Feide and LTI arrive in S3). The router therefore takes an
 *      `authenticate` middleware that puts the actor on `res.locals`, and every route that needs a person
 *      reads it through `requireActor`, which answers 401 when nobody is signed in.
 * Spec: H5P-006
 * Invariants:
 *   - Routes never trust request data for identity; only `authenticate` sets `res.locals.h5pActor`.
 *   - `requireRole` answers 403 for a signed-in person without one of the roles.
 * Collaborators: ./createH5pRouter.ts, ../h5p/HvlH5pUser.ts; S3 provides the real `authenticate`.
 * Tests: apps/server/test/http/router.int.test.ts
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { principalOf } from '../auth/principalLocals.js';
import type { H5pRole, HvlH5pActor } from '../h5p/HvlH5pUser.js';
import { DEFAULT_LOCALE, type Locale } from '../i18n/translate.js';
import { HttpError } from './HttpError.js';

/** Middleware that identifies the person behind a request and sets `res.locals.h5pActor` (S3). */
export type Authenticate = RequestHandler;

/**
 * The authenticated actor of a request.
 * @param res - The response whose locals `authenticate` filled.
 * @returns The actor.
 * @throws HttpError 401 when nobody is signed in.
 */
export function requireActor(res: Response): HvlH5pActor {
  const actor = res.locals.h5pActor as HvlH5pActor | undefined;
  if (!actor) throw new HttpError(401, 'error.unauthenticated');
  return actor;
}

/**
 * The language for messages: the H5P actor's, else the principal's (routes outside `/h5p`, such as `/api`), or
 * Nynorsk when nobody is signed in.
 * @param res - The response.
 * @returns A supported locale.
 */
export const localeOf = (res: Response): Locale =>
  (res.locals.h5pActor as HvlH5pActor | undefined)?.locale ?? principalOf(res)?.locale ?? DEFAULT_LOCALE;

/**
 * Middleware that lets only signed-in people with one of the roles through.
 * @param roles - Allowed roles.
 * @returns Express middleware.
 */
export const requireRole =
  (...roles: H5pRole[]): RequestHandler =>
  (_req: Request, res: Response, next: NextFunction) => {
    const actor = requireActor(res);
    if (!roles.includes(actor.role)) throw new HttpError(403, 'error.forbidden');
    next();
  };
