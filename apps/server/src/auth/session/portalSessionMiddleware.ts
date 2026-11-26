/**
 * portalSessionMiddleware — loads the portal session named by the `__Host-hvli_sid` cookie onto `res.locals`, and
 * starts or ends a session on a response.
 *
 * Why: every portal route needs the same answer to "is there a live session?", and login and logout must change
 *      the cookie and Redis together (AUTH-003, D-057). Without express-session, this file is that glue.
 * Spec: AUTH-003
 * Invariants:
 *   - Only this file sets the session on `res.locals`; routes read it through `portalSessionOf`.
 *   - A cookie that names no live session (unknown, idle 2 h, older than 12 h, malformed) counts as no session. A
 *     well-formed one is cleared by the response, unless a cache may keep that response (./staleCookieClearing.ts).
 *   - `startPortalSession` destroys any session the request carried before it creates the new one, so login always
 *     changes the session ID (session fixation), and marks the response `no-store`.
 *   - `endPortalSession` clears the cookie of the session it ended, and returns Feide's ID token once. Without a
 *     live session it changes no cookie: a logout request another site made the browser send carries no session
 *     cookie (`SameSite=Lax`), and must not log the person out (D-142).
 *   - CSRF is not checked here: ../requestPrincipal.ts checks it with ./csrfToken.ts once it knows the request is
 *     a portal request.
 * Collaborators: ./SessionStore.ts, ./sessionCookies.ts, ./staleCookieClearing.ts, ./csrfToken.ts,
 *   ../requestPrincipal.ts, ../feide/feideLoginRoutes.ts.
 * Tests: apps/server/test/auth/session/portalSessionMiddleware.int.test.ts
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { NewPortalSession, PortalSession, SessionStore } from './SessionStore.js';
import {
  expiredSessionCookie,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
  setCookie,
} from './sessionCookies.js';
import { clearSessionCookieOnUncachedAnswer } from './staleCookieClearing.js';

/** A live session together with its ID (the ID is needed only to end it). */
export interface ActivePortalSession {
  /** The session ID from the cookie. */
  readonly sid: string;
  /** The session. */
  readonly session: PortalSession;
}

// WHY: one private key per fact, so no other code writes them by accident; accessors below give them types.
const ACTIVE = 'hvliPortalSession';
const STALE = 'hvliStaleSessionCookie';

/**
 * The live portal session of a request.
 * @param res - The response the middleware ran on.
 * @returns The session and its ID, or undefined when the request has none.
 */
export const portalSessionOf = (res: Response): ActivePortalSession | undefined =>
  res.locals[ACTIVE] as ActivePortalSession | undefined;

/**
 * Tells whether the request sent a session cookie that no longer names a live session.
 * @param res - The response the middleware ran on.
 * @returns True when the cookie was present but named no live session (unknown or expired).
 */
export const hadStaleSessionCookie = (res: Response): boolean => res.locals[STALE] === true;

/**
 * Middleware that loads the session named by the session cookie.
 * @param store - The session store.
 * @returns Express middleware; Redis failures reach the error handler (fail closed).
 */
export function portalSessionMiddleware(store: SessionStore): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sid = readCookie(req, SESSION_COOKIE);
    if (sid !== undefined) {
      const session = await store.get(sid);
      if (session) {
        res.locals[ACTIVE] = { sid, session } satisfies ActivePortalSession;
      } else {
        // WHY: the browser would otherwise send a dead ID on every request until it closes.
        res.locals[STALE] = true;
        // SECURITY: decided when the headers are written; a file a cache may keep never carries the order (D-142).
        clearSessionCookieOnUncachedAnswer(res);
      }
    }
    next();
  };
}

/**
 * Starts a new session after login and sets its cookie; destroys the session the request carried, if any.
 * @param store - The session store.
 * @param res - The login callback's response, before anything is sent.
 * @param data - Facts computed at login and Feide's ID token.
 * @returns The new session and its ID.
 */
export async function startPortalSession(
  store: SessionStore,
  res: Response,
  data: NewPortalSession,
): Promise<ActivePortalSession> {
  const previous = portalSessionOf(res);
  // SECURITY: login never keeps a session ID that existed before it, so an ID planted in the browser (session
  // fixation) or left by the previous user of a shared PC is worthless afterwards.
  if (previous) await store.destroy(previous.sid);
  const created = await store.create(data);
  setCookie(res, sessionCookie(created.sid));
  // SECURITY: no-store keeps a shared cache from storing this answer and replaying its session cookie to others.
  res.setHeader('Cache-Control', 'no-store');
  const active: ActivePortalSession = { sid: created.sid, session: created.session };
  res.locals[ACTIVE] = active;
  delete res.locals[STALE];
  return active;
}

/**
 * Ends the request's session (logout): deletes it in Redis and clears its cookie.
 * @param store - The session store.
 * @param res - The logout response, before anything is sent.
 * @returns Feide's ID token for `id_token_hint`, or undefined when no live session was found (D-021); then no
 *   cookie is changed.
 */
export async function endPortalSession(store: SessionStore, res: Response): Promise<string | undefined> {
  const active = portalSessionOf(res);
  res.setHeader('Cache-Control', 'no-store');
  // SECURITY: a request without a live session ends nothing, so it clears nothing: a logout another site made the
  // browser send arrives without the session cookie and never reaches the CSRF check (D-142).
  if (!active) return undefined;
  delete res.locals[ACTIVE];
  setCookie(res, expiredSessionCookie());
  return store.destroy(active.sid);
}
