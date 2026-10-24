/**
 * ActivityView — the activity page (`/aktivitet/[id]`): its title and status, and the tabs **Spel**, **Rediger**
 * (for those who may edit) and **Sjekk og publiser** (for those who may publish).
 *
 * Why: authors play, edit, check and publish an activity in one place (PROD-003, LTI-006). The tabs frame Express's
 *      H5P pages (D-067). The editor reports each save (`hvli:content-saved`), after which the player reloads and the
 *      findings are fetched again; "Gå til feltet" opens the editor tab and asks the editor to focus the field.
 * Spec: PROD-003, PROD-011, LTI-006, UD-006, H5P-006, UD-010
 * Invariants:
 *   - The tabs offered follow the server's `mayEdit` and `mayPublish`; the server checks every request again.
 *   - The formative-use notice is on the editor tab (PROD-011).
 *   - Signed out: the Feide login link back to this page; unavailable: one message, whatever the reason (D-066).
 *   - Once the activity has loaded, the document title names it ("<title> – HVL Interaktiv", WCAG 2.4.2), and every
 *     save is announced, also the second save with the same words (WCAG 4.1.3, ../../components/useAnnouncement.ts).
 *   - The heading carries the activity's own language when it differs from the page's (`lang`, UD-010).
 * Collaborators: ./CheckPanel.tsx, ../../components/Tabs.tsx, ../../components/H5pFrame.tsx,
 *   ../../components/Notice.tsx, ../../messaging/frameMessages.ts, ../../messaging/useEditorSaved.ts.
 * Tests: apps/web/test/features/ActivityView.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiAuthProvider } from '../../api/ApiAuthContext';
import type { ApiAuth } from '../../api/apiRequest';
import { getContent } from '../../api/contentApi';
import type { PortalSession } from '../../api/portalSession';
import { usePortalSession } from '../../api/usePortalSession';
import { activityPath, editorPath, playerPath } from '../../config/paths';
import { H5pFrame } from '../../components/H5pFrame';
import { LoginPrompt } from '../../components/LoginPrompt';
import { Notice } from '../../components/Notice';
import { StatusBadge } from '../../components/StatusBadge';
import { Tabs, type TabItem } from '../../components/Tabs';
import { useAnnouncement } from '../../components/useAnnouncement';
import { useLocale } from '../../i18n/LocaleContext';
import { pageTitle } from '../../i18n/pageTitle';
import { partLanguage } from '../../i18n/partLanguage';
import { t } from '../../i18n/translate';
import { postGoToField } from '../../messaging/frameMessages';
import { useEditorSaved } from '../../messaging/useEditorSaved';
import { CheckPanel } from './CheckPanel';

type Detail = ContentDetail | 'loading' | 'unavailable' | 'failed';

/** The tabs' identifiers. */
const PLAY_TAB = 'play';
const EDIT_TAB = 'edit';
const CHECK_TAB = 'check';

function Workspace({ contentId, session }: { readonly contentId: string; readonly session: PortalSession }) {
  const locale = useLocale();
  const auth = useMemo<ApiAuth>(
    () => ({ kind: 'portal', csrfToken: session.csrfToken }),
    [session.csrfToken],
  );
  const [detail, setDetail] = useState<Detail>('loading');
  const [tab, setTab] = useState(PLAY_TAB);
  const [revision, setRevision] = useState(0);
  const [announcement, announce] = useAnnouncement();
  const [editorReady, setEditorReady] = useState(false);
  const [goTo, setGoTo] = useState<{ readonly path: string; readonly at: number }>();
  const playerRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<HTMLIFrameElement>(null);
  const postedAt = useRef(0);

  const loadDetail = useCallback(async () => {
    const result = await getContent(contentId, auth);
    if (result.ok) setDetail(result.data);
    else setDetail(result.status === 404 || result.status === 403 ? 'unavailable' : 'failed');
  }, [contentId, auth]);

  useEffect(() => {
    let active = true;
    void getContent(contentId, auth).then((result) => {
      if (!active) return;
      if (result.ok) setDetail(result.data);
      else setDetail(result.status === 404 || result.status === 403 ? 'unavailable' : 'failed');
    });
    return () => {
      active = false;
    };
  }, [contentId, auth]);

  useEditorSaved(editorRef, () => {
    setRevision((value) => value + 1);
    announce(t('activity.saved', locale));
    void loadDetail();
  });

  useEffect(() => {
    // A11Y: WCAG 2.4.2: the server cannot know the title (D-068), so the page names the activity once it has loaded.
    if (typeof detail === 'object') document.title = pageTitle(detail.title, locale);
  }, [detail, locale]);

  useEffect(() => {
    if (!goTo || tab !== EDIT_TAB || !editorReady || postedAt.current === goTo.at) return;
    postedAt.current = goTo.at;
    postGoToField(editorRef.current, goTo.path);
  }, [goTo, tab, editorReady]);

  if (detail === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (detail === 'unavailable') return <p role="alert">{t('activity.unavailable', locale)}</p>;
  if (detail === 'failed') return <p role="alert">{t('common.loadFailed', locale)}</p>;

  const tabs: TabItem[] = [
    {
      id: PLAY_TAB,
      label: t('activity.tabPlay', locale),
      panel: (
        <H5pFrame
          key={revision}
          src={playerPath(detail.id)}
          title={t('activity.playFrame', locale, { title: detail.title })}
          frameRef={playerRef}
        />
      ),
    },
  ];
  if (detail.mayEdit) {
    tabs.push({
      id: EDIT_TAB,
      label: t('activity.tabEdit', locale),
      panel: (
        <>
          <Notice />
          <H5pFrame
            editor
            src={editorPath(detail.id)}
            title={t('activity.editFrame', locale, { title: detail.title })}
            frameRef={editorRef}
            onLoad={() => setEditorReady(true)}
          />
        </>
      ),
    });
  }
  if (detail.mayPublish) {
    tabs.push({
      id: CHECK_TAB,
      label: t('activity.tabCheck', locale),
      panel: (
        <CheckPanel
          detail={detail}
          revision={revision}
          onGoToField={(path) => {
            setTab(EDIT_TAB);
            setGoTo({ path, at: Date.now() });
          }}
          onStatusChange={loadDetail}
        />
      ),
    });
  }

  return (
    <ApiAuthProvider auth={auth}>
      <h1 lang={partLanguage(detail.language, locale)}>{detail.title}</h1>
      <p className="flex flex-wrap items-center gap-2">
        {t('activity.statusLabel', locale)}
        <StatusBadge status={detail.status} locale={locale} />
      </p>
      {detail.status === 'published' && detail.mayEdit ? <p>{t('activity.publishedNote', locale)}</p> : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Tabs
        label={t('activity.tabsLabel', locale)}
        tabs={tabs}
        selectedId={tab}
        onSelect={setTab}
        manualActivation
      />
    </ApiAuthProvider>
  );
}

/**
 * The activity page's content.
 * @param props - The activity's ID from the address.
 * @returns The signed-out prompt or the workspace.
 */
export function ActivityView({ contentId }: { readonly contentId: string }) {
  const locale = useLocale();
  const session = usePortalSession();
  if (session.status === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (session.status === 'error') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  if (session.status === 'signedOut') {
    return (
      <LoginPrompt locale={locale} message={t('login.required', locale)} returnTo={activityPath(contentId)} />
    );
  }
  return <Workspace contentId={contentId} session={session.session} />;
}
