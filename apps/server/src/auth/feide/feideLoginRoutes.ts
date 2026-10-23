/**
 * feideLoginRoutes — `/auth/feide/login`, `/auth/feide/callback`, `/auth/logout` and `/auth/session`.
 *
 * Why: the portal signs people in with Feide (AUTH-001) and keeps them in a Redis session (AUTH-003). The login
 *      transaction cookie binds the callback to the browser that started the login (login CSRF, D-057); logout ends
 *      the session and sends the browser to Feide's end-session endpoint with `id_token_hint` (D-021).
 * Spec: AUTH-001, AUTH-003, AUTH-004
 * Invariants:
 *   - The return path is reduced to a local path at both ends of the login (./../returnTo.ts).
 *   - The login cookie is cleared at every callback, used or not; a callback without its transaction is refused.
 *   - The callback URL handed to openid-client is built on `PUBLIC_BASE_URL`, never on request headers.
 *   - Logout is a POST checked against the session's CSRF token; `/auth/session` gives the token to page scripts.
 *   - Errors are friendly pages (./../../http/pages/portalPages.ts), never JSON or stack traces.
 * Collaborators: ./FeideClient.ts, ./loginTransactions.ts, ./completeFeideLogin.ts, ../session/,
 *   ../audit/AuthAuditRecorder.ts.
 * Tests: apps/server/test/auth/feide/feideLogin.int.test.ts, apps/server/test/auth/feide/feideLogout.int.test.ts
 */
import express, { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import { authError } from '../../http/authErrors.js';
import { sendPortalError, sendPortalPage } from '../../http/pages/portalPages.js';
import type { AuthAuditRecorder } from '../audit/AuthAuditRecorder.js';
import { safeReturnTo } from '../returnTo.js';
import { assertCsrf } from '../session/csrfToken.js';
import { endPortalSession, portalSessionOf, startPortalSession } from '../session/portalSessionMiddleware.js';
import {
  expiredLoginCookie,
  LOGIN_COOKIE,
  loginCookie,
  readCookie,
  setCookie,
} from '../session/sessionCookies.js';
import type { SessionStore } from '../session/SessionStore.js';
import { completeFeideLogin, type FeideLoginDeps } from './completeFeideLogin.js';
import type { FeideClient } from './FeideClient.js';
import type { LoginTransactions } from './loginTransactions.js';

/** What the routes need. */
export interface FeideRouteDeps {
  readonly feide: Pick<FeideClient, 'authorizationUrl' | 'endSessionUrl'> & FeideLoginDeps['feide'];
  readonly transactions: LoginTransactions;
  readonly sessions: SessionStore;
  readonly login: Omit<FeideLoginDeps, 'feide'>;
  readonly audit: Pick<AuthAuditRecorder, 'record'>;
  readonly publicBaseUrl: string;
  readonly logger: Logger;
}

const queryText = (req: Request, name: string): string | undefined => {
  const value = req.query[name];
  return typeof value === 'string' ? value : undefined;
};

/**
 * Builds the Feide login and session routes.
 * @param deps - Feide client, login transactions, session store, login dependencies, audit, base URL, logger.
 * @returns A router to mount at `/`.
 */
export function feideLoginRoutes(deps: FeideRouteDeps): Router {
  const router = Router();
  const handle =
    (run: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response): Promise<void> =>
      run(req, res).catch((error: unknown) => sendPortalError(res, error, deps.logger));

  router.get(
    '/auth/feide/login',
    handle(async (req, res) => {
      const tx = await deps.transactions.begin({ returnTo: safeReturnTo(queryText(req, 'returnTo')) });
      let url: URL;
      try {
        url = await deps.feide.authorizationUrl(tx);
      } catch {
        // WHY: Feide's discovery document is unreachable; the same "cannot reach Feide" page as a Groups API outage.
        throw authError('hvl:feide-groups-unavailable');
      }
      setCookie(res, loginCookie(tx.txId));
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(302, url.href);
    }),
  );

  router.get(
    '/auth/feide/callback',
    handle(async (req, res) => {
      const txId = readCookie(req, LOGIN_COOKIE);
      setCookie(res, expiredLoginCookie());
      const tx = txId === undefined ? undefined : await deps.transactions.consume(txId);
      if (!tx) {
        // SECURITY: a callback this browser did not start (login CSRF) or one replayed after use.
        await deps.audit.record({ event: 'login.feide.failed', reason: 'state-invalid', ip: req.ip });
        throw authError('hvl:login-failed');
      }
      const callbackUrl = new URL(req.originalUrl, deps.publicBaseUrl);
      const session = await completeFeideLogin({ ...deps.login, feide: deps.feide }, callbackUrl, tx, req.ip);
      await startPortalSession(deps.sessions, res, session);
      res.redirect(303, safeReturnTo(tx.returnTo));
    }),
  );

  router.post(
    '/auth/logout',
    express.urlencoded({ extended: false, limit: '2kb' }),
    handle(async (req, res) => {
      const active = portalSessionOf(res);
      if (active) assertCsrf(req, active.session);
      const idToken = await endPortalSession(deps.sessions, res);
      if (active)
        await deps.audit.record({ event: 'logout', actorUserId: active.session.userId, ip: req.ip });
      const target = idToken ? await deps.feide.endSessionUrl(idToken).catch(() => undefined) : undefined;
      res.redirect(303, target?.href ?? '/');
    }),
  );

  router.get('/auth/session', (_req, res) => {
    const active = portalSessionOf(res);
    res.setHeader('Cache-Control', 'no-store');
    if (!active) {
      res.status(401).json({ success: false, errorCode: 'hvl:unauthenticated', httpStatusCode: 401 });
      return;
    }
    const { roles, locale, hvlMember, studentAuthor, csrfToken } = active.session;
    res.json({ roles, locale, hvlMember, studentAuthor, csrfToken });
  });

  router.get('/auth/logged-out', (_req, res) =>
    sendPortalPage(res, 200, {
      locale: 'nn',
      titleKey: 'page.loggedOut.title',
      bodyKey: 'page.loggedOut.body',
      action: { href: '/auth/feide/login', labelKey: 'page.login' },
    }),
  );
  return router;
}
