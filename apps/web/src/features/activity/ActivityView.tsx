/**
 * ActivityView — the activity page (`/aktivitet/[id]`): its title and status, and the tabs of the registry
 * (./tabs/activityTabs.ts): **Spel**, **Rediger** (for those who may edit) and **Sjekk og publiser** (for those who
 * may publish), plus the tabs S5 adds.
 *
 * Why: authors play, edit, check and publish an activity in one place (PROD-003, LTI-006). The tabs frame Express's
 *      H5P pages (D-067). The editor reports each save (`hvli:content-saved`), after which the player reloads and the
 *      findings are fetched again; "Gå til feltet" opens the editor tab and asks the editor to focus the field. The
 *      page owns this shared state and gives every tab the same props (./tabs/activityTab.ts), so a tab is one file.
 *      While the editor's save choice is open the page's own controls are inert, and «Lagre som ny versjon» opens
 *      the new version's editor (PROD-013, D-093).
 * Spec: PROD-003, PROD-011, LTI-006, UD-006, H5P-006, UD-010, PROD-013
 * Invariants:
 *   - The tabs offered follow the server's `mayEdit` and `mayPublish`; the server checks every request again.
 *   - The address may ask for a tab (`?fane=edit`, ../../config/paths.ts `activityPath`), e.g. after an activity was
 *     created from a pattern (D-085); a tab this person does not get falls back to **Spel**.
 *   - The formative-use notice is on the editor tab (PROD-011).
 *   - Signed out: the Feide login link back to this page and the tab it asked for; unavailable: one message, whatever
 *     the reason (D-066).
 *   - Once the activity has loaded, the document title names it ("<title> – HVL Interaktiv", WCAG 2.4.2), and every
 *     save is announced, also the second save with the same words (WCAG 4.1.3, ../../components/useAnnouncement.ts).
 *   - The heading carries the activity's own language when it differs from the page's (`lang`, UD-010).
 *   - After «Lagre som ny versjon» the page says it opens the new version, then goes to its Rediger tab; a copy's
 *     page shows where it came from to its editors (./SourceAttributionNote.tsx, PROD-007).
 * Collaborators: ./tabs/activityTabs.ts, ./tabs/activityTab.ts, ../../components/Tabs.tsx, ./useActivityEditor.ts
 *   (the editor frame's messages).
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/web/test/features/activityTabs.test.tsx,
 *   apps/web/test/features/activityTabProps.test.tsx, apps/web/test/features/ActivitySaveChoice.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiAuthProvider } from '../../api/ApiAuthContext';
import type { ApiAuth } from '../../api/apiRequest';
import { getContent } from '../../api/contentApi';
import type { PortalSession } from '../../api/portalSession';
import { usePortalSession } from '../../api/usePortalSession';
import { ACTIVITY_TAB_QUERY, activityPath } from '../../config/paths';
import { LoginPrompt } from '../../components/LoginPrompt';
import { StatusBadge } from '../../components/StatusBadge';
import { Tabs, type TabItem } from '../../components/Tabs';
import { useAnnouncement } from '../../components/useAnnouncement';
import { useLocale } from '../../i18n/LocaleContext';
import { pageTitle } from '../../i18n/pageTitle';
import { partLanguage } from '../../i18n/partLanguage';
import { t } from '../../i18n/translate';
import { SourceAttributionNote } from './SourceAttributionNote';
import type { ActivityTabProps } from './tabs/activityTab';
import { activityTabsFor, selectableTabId } from './tabs/activityTabs';
import { EDIT_TAB_ID } from './tabs/EditTab';
import { useActivityEditor } from './useActivityEditor';

type Detail = ContentDetail | 'loading' | 'unavailable' | 'failed';

/**
 * The tab the address asks for (`?fane=`).
 * @returns The requested tab `id`, or undefined.
 */
const requestedTab = (): string | undefined =>
  // WHY: the workspace and the login prompt render only in the browser, after the session has answered, so reading
  // the address here never differs from a server render.
  typeof window === 'undefined'
    ? undefined
    : (new URLSearchParams(window.location.search).get(ACTIVITY_TAB_QUERY) ?? undefined);

/** Where the page goes after «Lagre som ny versjon»: the browser's own navigation by default. */
type Navigate = (path: string) => void;

function Workspace({
  contentId,
  session,
  navigate,
}: {
  readonly contentId: string;
  readonly session: PortalSession;
  readonly navigate: Navigate;
}) {
  const locale = useLocale();
  const auth = useMemo<ApiAuth>(
    () => ({ kind: 'portal', csrfToken: session.csrfToken }),
    [session.csrfToken],
  );
  const [detail, setDetail] = useState<Detail>('loading');
  const [tab, setTab] = useState<string | undefined>(requestedTab);
  const [revision, setRevision] = useState(0);
  const [announcement, announce] = useAnnouncement();
  const playerRef = useRef<HTMLIFrameElement>(null);

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

  const editor = useActivityEditor({
    tab,
    setTab,
    onSaved: () => {
      setRevision((value) => value + 1);
      announce(t('activity.saved', locale));
      void loadDetail();
    },
    // PROD-013: the edit now lives in the new private draft, so its editor opens (D-093).
    onCopied: (copyId) => {
      announce(t('safeEditing.openingCopy', locale));
      navigate(activityPath(copyId, EDIT_TAB_ID));
    },
  });

  useEffect(() => {
    // A11Y: WCAG 2.4.2: the server cannot know the title (D-068), so the page names the activity once it has loaded.
    if (typeof detail === 'object') document.title = pageTitle(detail.title, locale);
  }, [detail, locale]);

  if (detail === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (detail === 'unavailable') return <p role="alert">{t('activity.unavailable', locale)}</p>;
  if (detail === 'failed') return <p role="alert">{t('common.loadFailed', locale)}</p>;

  const shown = activityTabsFor(detail);
  const tabProps: ActivityTabProps = {
    detail,
    revision,
    reloadDetail: loadDetail,
    goToField: editor.goToField,
    selectTab: (id) => {
      if (shown.some((item) => item.id === id)) setTab(id);
    },
    announce,
    frames: { playerRef, editorRef: editor.editorRef, onEditorLoad: editor.onEditorLoad },
  };
  const tabs: TabItem[] = shown.map(({ id, labelKey, Panel }) => ({
    id,
    label: t(labelKey, locale),
    panel: <Panel {...tabProps} />,
  }));

  return (
    <ApiAuthProvider auth={auth}>
      <h1 lang={partLanguage(detail.language, locale)}>{detail.title}</h1>
      <p className="flex flex-wrap items-center gap-2">
        {t('activity.statusLabel', locale)}
        <StatusBadge status={detail.status} locale={locale} />
      </p>
      {detail.status === 'published' && detail.mayEdit ? <p>{t('activity.publishedNote', locale)}</p> : null}
      <SourceAttributionNote detail={detail} />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Tabs
        label={t('activity.tabsLabel', locale)}
        tabs={tabs}
        selectedId={selectableTabId(tab, shown)}
        onSelect={setTab}
        manualActivation
      />
    </ApiAuthProvider>
  );
}

/**
 * The activity page's content.
 * @param props - The activity's ID from the address, and where to go after «Lagre som ny versjon» (the browser's
 *   own navigation by default).
 * @returns The signed-out prompt or the workspace.
 */
export function ActivityView({
  contentId,
  navigate = (path: string) => window.location.assign(path),
}: {
  readonly contentId: string;
  readonly navigate?: Navigate;
}) {
  const locale = useLocale();
  const session = usePortalSession();
  if (session.status === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (session.status === 'error') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  if (session.status === 'signedOut') {
    return (
      <LoginPrompt
        locale={locale}
        message={t('login.required', locale)}
        returnTo={activityPath(contentId, requestedTab())}
      />
    );
  }
  return <Workspace contentId={contentId} session={session.session} navigate={navigate} />;
}
