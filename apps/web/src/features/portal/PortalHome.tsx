/**
 * PortalHome — the start page's content: the Feide login link when signed out; the person's activities, "Ny
 * aktivitet" and logout when signed in.
 *
 * Why: Feide login returns to `/` and logout ends there (AUTH-001, AUTH-003). Authors start from their own and
 *      co-authored activities (`GET /api/content`), with each one's status (PROD-003); learners find theirs in Canvas.
 * Spec: AUTH-001, AUTH-003, PROD-003
 * Invariants:
 *   - Logout is a POST form to `/auth/logout` carrying the session's CSRF token in the field `csrf` (D-057).
 *   - "Ny aktivitet" is offered only to authors and admins; the server checks the role again.
 *   - Nothing is shown about a person but their own activities (DATA-002).
 * Collaborators: ../../api/usePortalSession.ts, ../../api/contentApi.ts, ./ActivityList.tsx,
 *   ../../components/LoginPrompt.tsx, ../../app/(portal)/page.tsx.
 * Tests: apps/web/test/features/PortalHome.test.tsx
 */
'use client';

import type { ContentSummary } from '@hvl-interaktiv/api-contract';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listContent } from '../../api/contentApi';
import { isAuthor, type PortalSession } from '../../api/portalSession';
import { usePortalSession } from '../../api/usePortalSession';
import { LoginPrompt } from '../../components/LoginPrompt';
import { LOGOUT_PATH, NEW_ACTIVITY_PATH } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { ActivityList } from './ActivityList';

/** The CSRF form field of `/auth/logout` (apps/server/src/auth/session/csrfToken.ts, `CSRF_PARAM`). */
export const LOGOUT_CSRF_FIELD = 'csrf';

/**
 * The logout button: a POST form with the CSRF token.
 * @param props - The session and its locale.
 * @returns The form.
 */
export function LogoutForm({ session }: { readonly session: PortalSession }) {
  const locale = useLocale();
  return (
    <form method="post" action={LOGOUT_PATH}>
      <input type="hidden" name={LOGOUT_CSRF_FIELD} value={session.csrfToken} />
      <button type="submit" className="button-secondary">
        {t('login.logout', locale)}
      </button>
    </form>
  );
}

function SignedIn({ session }: { readonly session: PortalSession }) {
  const locale = useLocale();
  const [items, setItems] = useState<readonly ContentSummary[] | 'loading' | 'failed'>('loading');
  useEffect(() => {
    let active = true;
    void listContent({ kind: 'portal', csrfToken: session.csrfToken }).then((result) => {
      if (active) setItems(result.ok ? result.data.items : 'failed');
    });
    return () => {
      active = false;
    };
  }, [session.csrfToken]);
  const author = isAuthor(session);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {author ? (
          <Link href={NEW_ACTIVITY_PATH} className="button-primary">
            {t('home.new', locale)}
          </Link>
        ) : null}
        <LogoutForm session={session} />
      </div>
      {author ? null : <p>{t('home.learner', locale)}</p>}
      <h2>{t('home.activities', locale)}</h2>
      {items === 'loading' ? <p role="status">{t('common.loading', locale)}</p> : null}
      {items === 'failed' ? <p role="alert">{t('common.loadFailed', locale)}</p> : null}
      {Array.isArray(items) ? <ActivityList items={items} /> : null}
    </>
  );
}

/**
 * The start page's content.
 * @returns The signed-out or signed-in view.
 */
export function PortalHome() {
  const locale = useLocale();
  const session = usePortalSession();
  return (
    <>
      <h1>{t('site.name', locale)}</h1>
      <p>{t('home.intro', locale)}</p>
      {session.status === 'loading' ? <p role="status">{t('common.loading', locale)}</p> : null}
      {session.status === 'error' ? <p role="alert">{t('common.loadFailed', locale)}</p> : null}
      {session.status === 'signedOut' ? (
        <LoginPrompt locale={locale} message={t('home.signedOut', locale)} />
      ) : null}
      {session.status === 'signedIn' ? <SignedIn session={session.session} /> : null}
    </>
  );
}
