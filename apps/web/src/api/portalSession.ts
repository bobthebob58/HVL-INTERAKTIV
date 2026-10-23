/**
 * portalSession — asks Express whether the browser has a Feide session, and for its CSRF token.
 *
 * Why: the web app never sees the session cookie (D-068), so a portal page learns in the browser whether someone is
 *      signed in (`GET /auth/session`, AUTH-003). The answer carries the CSRF token that PUT, POST and PATCH need, and
 *      the roles that decide what the page offers; it carries no name, e-mail address or ID (DATA-002).
 * Spec: AUTH-003, DATA-002
 * Invariants:
 *   - 401 means signed out; any other failure is an error, never a session.
 *   - Only the fields below are kept; anything else in the answer is dropped.
 * Collaborators: apps/server/src/auth/feide/feideLoginRoutes.ts (`/auth/session`), ./usePortalSession.ts.
 * Tests: apps/web/test/api/portalSession.test.ts
 */
import type { ApiLocale, ApiRole } from '@hvl-interaktiv/api-contract';
import { apiRequest } from './apiRequest';

/** What a page may know about the signed-in person. */
export interface PortalSession {
  readonly roles: readonly ApiRole[];
  readonly locale: ApiLocale;
  /** The synchronizer token for unsafe requests and the logout form. */
  readonly csrfToken: string;
}

/** The answer: a session, signed out, or the server could not be asked. */
export type PortalSessionResult =
  | { readonly status: 'signedIn'; readonly session: PortalSession }
  | { readonly status: 'signedOut' }
  | { readonly status: 'error' };

/** The path of the session endpoint. */
export const SESSION_PATH = '/auth/session';

/**
 * Whether the person may create and edit activities (the server checks it again on every request).
 * @param session - The portal session.
 * @returns True for authors and admins.
 */
export const isAuthor = (session: PortalSession): boolean =>
  session.roles.includes('author') || session.roles.includes('admin');

/**
 * Asks for the session.
 * @returns The session, signed out, or an error.
 */
export async function fetchPortalSession(): Promise<PortalSessionResult> {
  const result = await apiRequest<Partial<PortalSession>>(SESSION_PATH, { kind: 'portal' });
  if (!result.ok) return result.status === 401 ? { status: 'signedOut' } : { status: 'error' };
  const { roles, locale, csrfToken } = result.data ?? {};
  if (!Array.isArray(roles) || typeof csrfToken !== 'string' || typeof locale !== 'string') {
    return { status: 'error' };
  }
  return { status: 'signedIn', session: { roles, locale, csrfToken } };
}
