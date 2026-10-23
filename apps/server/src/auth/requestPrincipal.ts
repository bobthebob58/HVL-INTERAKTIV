/**
 * requestPrincipal — the authentication middleware: finds out who is making a request, from an ltik (Canvas) or
 * the portal session (Feide), and puts the `Principal` on the response.
 *
 * Why: both entry points end in one principal (spec 02 §2). LTI requests carry the ltik as `Authorization: Bearer`;
 *      only the paths in `LTIK_QUERY_PATHS` may carry it in the query (D-058, D-069), because H5P and the first page
 *      load cannot set headers.
 *      Portal requests carry the session cookie, so every state-changing request needs the CSRF token (D-057).
 * Spec: LTI-003, AUTH-003, H5P-007
 * Invariants:
 *   - An ltik in the query anywhere else is refused (401), so tokens do not spread into other URLs and logs.
 *   - A request with both a Bearer ltik and a query ltik must carry the same token.
 *   - An ltik wins over a session cookie: inside Canvas, a portal cookie never changes who the request acts as.
 *   - Portal requests pass the CSRF check where `csrfRequired` says so (unsafe methods, any H5P AJAX/user data).
 *   - No principal is set when nobody is signed in; routes that need one answer 401 (`requirePrincipal`).
 * Collaborators: ../lti/ltikPrincipal.ts, ./session/portalSessionMiddleware.ts, ./session/csrfToken.ts,
 *   ./principalLocals.ts, ../http/h5pAuthenticate.ts, ../server/createApp.ts.
 * Tests: apps/server/test/auth/requestPrincipal.test.ts
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UrlToken } from '../h5p/HvlH5pUser.js';
import { authError } from '../http/authErrors.js';
import type { ResolvedLtik } from '../lti/ltikPrincipal.js';
import { sealPrincipal } from './Principal.js';
import { setPrincipal } from './principalLocals.js';
import { assertCsrfWhenRequired } from './session/csrfToken.js';
import { portalSessionOf } from './session/portalSessionMiddleware.js';

/** Paths that may carry the ltik as `?ltik=` (D-058). Matched on the full path, whatever the router mount. */
export const LTIK_QUERY_PATHS: readonly RegExp[] = Object.freeze([
  /^\/h5p\/ajax\/?$/,
  /^\/h5p\/contentUserData\/[^/]+\/[^/]+\/[^/]+\/?$/,
  /^\/lti\/play\/?$/,
  /^\/lti\/edit\/?$/,
  /^\/lti\/deeplink\/?$/,
]);

const URL_TOKEN = 'hvliUrlToken';

/**
 * The token this request's H5P URLs must carry (ltik or CSRF), set by `requestPrincipal`.
 * @param res - The response.
 * @returns The token, or undefined when nobody is signed in.
 */
export const urlTokenOf = (res: Response): UrlToken | undefined =>
  res.locals[URL_TOKEN] as UrlToken | undefined;

const pathOf = (req: Request): string => {
  try {
    return decodeURIComponent(new URL(req.originalUrl, 'http://x').pathname);
  } catch {
    return '';
  }
};

const bearerOf = (req: Request): string | undefined => {
  const match = /^Bearer ([\w.~+/=-]+)$/i.exec(req.headers.authorization ?? '');
  return match?.[1];
};

/**
 * Builds the authentication middleware.
 * @param resolveLtik - Resolves an ltik into a principal (../lti/ltikPrincipal.ts).
 * @returns Express middleware; refusals reach the error handler.
 */
export function requestPrincipal(resolveLtik: (ltik: string) => Promise<ResolvedLtik>): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const queryValue = req.query.ltik;
    const queryLtik = typeof queryValue === 'string' ? queryValue : undefined;
    if (queryValue !== undefined && queryLtik === undefined) throw authError('hvl:ltik-invalid');
    // SECURITY: an ltik in the query is accepted only where H5P or a first page load cannot send a header (D-058).
    if (queryLtik !== undefined && !LTIK_QUERY_PATHS.some((path) => path.test(pathOf(req)))) {
      throw authError('hvl:ltik-invalid');
    }
    const bearer = bearerOf(req);
    if (bearer !== undefined && queryLtik !== undefined && bearer !== queryLtik)
      throw authError('hvl:ltik-invalid');
    const ltik = bearer ?? queryLtik;
    if (ltik !== undefined) {
      const { principal } = await resolveLtik(ltik);
      setPrincipal(res, principal);
      res.locals[URL_TOKEN] = { name: 'ltik', value: ltik } satisfies UrlToken;
      return next();
    }
    if (req.headers.authorization !== undefined) throw authError('hvl:ltik-invalid');
    const active = portalSessionOf(res);
    if (active) {
      // SECURITY: the cookie is sent by the browser on its own, so the request must prove it came from our page.
      assertCsrfWhenRequired(req, active.session);
      const { userId, learnerKey, roles, locale, hvlMember, studentAuthor, csrfToken } = active.session;
      setPrincipal(
        res,
        sealPrincipal({
          userId,
          learnerKey,
          roles,
          locale,
          hvlMember,
          studentAuthor,
          mode: 'portal',
          feideAuthenticated: true,
        }),
      );
      res.locals[URL_TOKEN] = { name: 'csrf', value: csrfToken } satisfies UrlToken;
    }
    next();
  };
}
