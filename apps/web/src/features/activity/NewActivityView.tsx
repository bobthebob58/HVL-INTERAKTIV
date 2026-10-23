/**
 * NewActivityView — the new-activity page (`/aktivitet/ny`): H5P's editor for a new activity, then the activity's
 * own page after the first save.
 *
 * Why: authors create activities in H5P's editor (H5P-002), framed from Express (`/h5p/new`, D-067). After the first
 *      save the editor reports the new activity's ID (`hvli:content-saved`), and the page moves to `/aktivitet/<id>`,
 *      where it can be checked and published (PROD-003). The formative-use notice is shown with the editor (PROD-011).
 * Spec: H5P-002, PROD-003, PROD-011, H5P-006
 * Invariants:
 *   - Only authors and admins get the editor; the server refuses everyone else again (`requireRole`).
 *   - The page navigates only to an ID that came from its own editor frame and looks like an activity ID.
 * Collaborators: ../../messaging/useEditorSaved.ts, ../../components/H5pFrame.tsx, ../../components/Notice.tsx,
 *   ../../api/usePortalSession.ts, ../../app/(portal)/aktivitet/ny/page.tsx.
 * Tests: apps/web/test/features/NewActivityView.test.tsx
 */
'use client';

import { useMemo, useRef, useState } from 'react';
import { ApiAuthProvider } from '../../api/ApiAuthContext';
import type { ApiAuth } from '../../api/apiRequest';
import { isAuthor, type PortalSession } from '../../api/portalSession';
import { usePortalSession } from '../../api/usePortalSession';
import { activityPath, NEW_ACTIVITY_PATH, NEW_EDITOR_PATH } from '../../config/paths';
import { H5pFrame } from '../../components/H5pFrame';
import { LoginPrompt } from '../../components/LoginPrompt';
import { Notice } from '../../components/Notice';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useEditorSaved } from '../../messaging/useEditorSaved';

function Editor({
  session,
  onSaved,
}: {
  readonly session: PortalSession;
  readonly onSaved: (id: string) => void;
}) {
  const locale = useLocale();
  const auth = useMemo<ApiAuth>(
    () => ({ kind: 'portal', csrfToken: session.csrfToken }),
    [session.csrfToken],
  );
  const frame = useRef<HTMLIFrameElement>(null);
  useEditorSaved(frame, onSaved);
  return (
    <ApiAuthProvider auth={auth}>
      <Notice />
      <H5pFrame editor src={NEW_EDITOR_PATH} title={t('newActivity.frame', locale)} frameRef={frame} />
    </ApiAuthProvider>
  );
}

/**
 * The new-activity page's content.
 * @param props - Where to go after the first save; the browser's own navigation by default.
 * @returns The editor, or why it is not shown.
 */
export function NewActivityView({
  navigate = (path: string) => window.location.assign(path),
}: {
  readonly navigate?: (path: string) => void;
}) {
  const locale = useLocale();
  const session = usePortalSession();
  const [opening, setOpening] = useState(false);
  const onSaved = (contentId: string) => {
    setOpening(true);
    navigate(activityPath(contentId));
  };
  return (
    <>
      <h1>{t('newActivity.title', locale)}</h1>
      {session.status === 'loading' ? <p role="status">{t('common.loading', locale)}</p> : null}
      {session.status === 'error' ? <p role="alert">{t('common.loadFailed', locale)}</p> : null}
      {session.status === 'signedOut' ? (
        <LoginPrompt locale={locale} message={t('login.required', locale)} returnTo={NEW_ACTIVITY_PATH} />
      ) : null}
      {session.status === 'signedIn' && !isAuthor(session.session) ? (
        <p role="alert">{t('newActivity.notAllowed', locale)}</p>
      ) : null}
      {session.status === 'signedIn' && isAuthor(session.session) ? (
        <>
          <p>{t('newActivity.intro', locale)}</p>
          <p role="status">{opening ? t('newActivity.opening', locale) : ''}</p>
          <Editor session={session.session} onSaved={onSaved} />
        </>
      ) : null}
    </>
  );
}
