/**
 * LtiPlayView — the Canvas page's content: the activity's title and the tabs **Spel** and, for those who may edit,
 * **Rediger** with the formative-use notice.
 *
 * Why: LTI-006 gives learners the player and authors the player plus **Rediger** (D-062, D-067). The ltik arrives in
 *      the address bar once (D-069): the page reads it, keeps it in memory only, removes it from the address bar at
 *      once, and passes it to the framed H5P pages in their query and to the API as `Authorization: Bearer`.
 * Spec: LTI-006, LTI-003, PROD-011
 * Invariants:
 *   - The ltik is never written to storage, a cookie or a log; it is read from the address bar exactly once.
 *   - Without an ltik the page says to open the activity again from Canvas.
 *   - After a save in the editor the player reloads, so the author sees the change.
 * Collaborators: ../../lti/launchHeader.ts (the launch facts), ./LtiChrome.tsx, ../../components/Tabs.tsx,
 *   ../../components/H5pFrame.tsx, ../../components/Notice.tsx, ../../api/ApiAuthContext.tsx.
 * Tests: apps/web/test/features/LtiPlayView.test.tsx
 */
'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ApiAuthProvider } from '../../api/ApiAuthContext';
import type { ApiAuth } from '../../api/apiRequest';
import { H5pFrame } from '../../components/H5pFrame';
import { ltiFramePath } from '../../config/paths';
import { Notice } from '../../components/Notice';
import { Tabs, type TabItem } from '../../components/Tabs';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import type { AppLaunch } from '../../lti/launchHeader';
import { useEditorSaved } from '../../messaging/useEditorSaved';
import { takeLtik } from './ltikFromAddress';

const noSubscription = () => () => undefined;

/** The tabs' identifiers. */
const PLAY_TAB = 'play';
const EDIT_TAB = 'edit';

/**
 * The message for a page opened without a launch.
 * @returns The heading and the explanation.
 */
export function NoLaunch() {
  const locale = useLocale();
  return (
    <>
      <h1>{t('lti.noLaunchTitle', locale)}</h1>
      <p>{t('lti.noLaunchBody', locale)}</p>
    </>
  );
}

/**
 * The Canvas page's content.
 * @param props - The launch Express resolved.
 * @returns The tabs, or the reopen message without an ltik.
 */
export function LtiPlayView({ launch }: { readonly launch: AppLaunch }) {
  const locale = useLocale();
  // SECURITY: LTI-003: the ltik is taken from the address bar once and kept in memory only (./ltikFromAddress.ts).
  const ltik = useSyncExternalStore(noSubscription, takeLtik, () => undefined);
  const auth = useMemo<ApiAuth | undefined>(() => (ltik ? { kind: 'lti', ltik } : undefined), [ltik]);
  const [tab, setTab] = useState(PLAY_TAB);
  const [revision, setRevision] = useState(0);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<HTMLIFrameElement>(null);
  useEditorSaved(editorRef, () => setRevision((value) => value + 1));

  if (ltik === undefined) return <p role="status">{t('common.loading', locale)}</p>;
  if (ltik === null || !auth) return <NoLaunch />;

  const tabs: TabItem[] = [
    {
      id: PLAY_TAB,
      label: t('activity.tabPlay', locale),
      panel: (
        <H5pFrame
          key={revision}
          src={ltiFramePath(PLAY_TAB, ltik)}
          title={t('activity.playFrame', locale, { title: launch.title })}
          frameRef={playerRef}
        />
      ),
    },
  ];
  if (launch.mayEdit) {
    tabs.push({
      id: EDIT_TAB,
      label: t('activity.tabEdit', locale),
      panel: (
        <>
          <Notice />
          <H5pFrame
            editor
            src={ltiFramePath(EDIT_TAB, ltik)}
            title={t('activity.editFrame', locale, { title: launch.title })}
            frameRef={editorRef}
          />
        </>
      ),
    });
  }
  return (
    <ApiAuthProvider auth={auth}>
      <h1>{launch.title}</h1>
      {tabs.length > 1 ? (
        <Tabs
          label={t('activity.tabsLabel', locale)}
          tabs={tabs}
          selectedId={tab}
          onSelect={setTab}
          manualActivation
        />
      ) : (
        tabs[0]?.panel
      )}
    </ApiAuthProvider>
  );
}
