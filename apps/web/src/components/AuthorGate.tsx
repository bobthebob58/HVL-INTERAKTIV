/**
 * AuthorGate — the states of an author-only portal page before its content: loading, the Feide login link back to
 * the page, a refusal for people who are not authors, or the content with the session's credential.
 *
 * Why: the planner, the content bank and the portfolio are for authors only (D-089), with the same sign-in redirect
 *      and refusal as the other portal pages (../features/activity/NewActivityView.tsx). The web app never sees the
 *      session (D-068), so the page learns in the browser who is signed in; one component keeps the pages alike.
 * Spec: AUTH-001, AUTH-003, UD-013
 * Invariants:
 *   - The content renders only for a signed-in author or admin; the server checks every request again.
 *   - The login link returns to this page with its query (`?emne=` and the like), which the server reduces to a local
 *     path again (apps/server/src/auth/returnTo.ts); the address is read only in the browser, after the session
 *     answer, so it never differs from a server render.
 *   - The content is wrapped in the portal credential (cookie and CSRF token), so its API calls need no props.
 * Collaborators: ../api/usePortalSession.ts, ../api/ApiAuthContext.tsx, ./LoginPrompt.tsx, the views in
 *   ../features/planner/, ../features/bank/, ../features/mappe/.
 * Tests: apps/web/test/components/AuthorGate.test.tsx
 */
'use client';

import { useMemo, type ReactNode } from 'react';
import { ApiAuthProvider } from '../api/ApiAuthContext';
import type { ApiAuth } from '../api/apiRequest';
import { isAuthor, type PortalSession } from '../api/portalSession';
import { usePortalSession } from '../api/usePortalSession';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n/translate';
import { LoginPrompt } from './LoginPrompt';

/** What the gate needs. */
export interface AuthorGateProps {
  /** Where the login returns to; the current path and query by default. */
  readonly returnTo?: string;
  /** The page's content for a signed-in author. */
  readonly children: (session: PortalSession) => ReactNode;
}

const currentPath = (): string =>
  typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`;

/**
 * Shows an author-only page's content, or why it is not shown.
 * @param props - Where the login returns to, and the content.
 * @returns A status, the login prompt, a refusal, or the content.
 */
export function AuthorGate({ returnTo, children }: AuthorGateProps) {
  const locale = useLocale();
  const state = usePortalSession();
  const csrfToken = state.status === 'signedIn' ? state.session.csrfToken : undefined;
  const auth = useMemo<ApiAuth>(() => ({ kind: 'portal', csrfToken }), [csrfToken]);
  if (state.status === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (state.status === 'error') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  if (state.status === 'signedOut') {
    return (
      <LoginPrompt
        locale={locale}
        message={t('login.required', locale)}
        returnTo={returnTo ?? currentPath()}
      />
    );
  }
  if (!isAuthor(state.session)) return <p role="alert">{t('studio.authorsOnly', locale)}</p>;
  return <ApiAuthProvider auth={auth}>{children(state.session)}</ApiAuthProvider>;
}
