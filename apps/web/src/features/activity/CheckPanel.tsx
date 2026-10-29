/**
 * CheckPanel — the **Sjekk og publiser** tab: the validator's findings for the stored activity, publishing through
 * the publish dialog, a new reason for a published activity with an error that has no reason that holds, and the way
 * back to draft.
 *
 * Why: PROD-003 lists the validator's findings with *Go to field* before publishing. The findings belong to one
 *      `updatedAt` (D-074): they are fetched again after every save (`revision`), after publishing or unpublishing,
 *      and, with the activity, whenever the server says it changed. A reason holds 14 days and an error found by a
 *      later rule never had one; both show as `acknowledgement: null` (the note names neither), every save of the
 *      published activity is refused while one stays, and publishing again gives new reasons (D-074 W3 amendment).
 *      The tab may add a notice to the first-publish dialog (the learning-design prompt, D-087); it never blocks.
 * Spec: PROD-003, UD-022, UD-013, UD-006, PED-030
 * Invariants:
 *   - Publishing always sends the `updatedAt` of the findings on screen; unpublishing the same.
 *   - A published activity offers the dialog (**Grunngje på nytt**) only while an error has no reason that holds and
 *     findings and activity are of the same `updatedAt`; otherwise it offers only the way back to draft.
 *   - **Publiser** (draft) and **Gjer om til utkast** (published) are one button element, so focus stays on it when
 *     the status changes; it gets focus after a publish, and whenever the focused control went away (**Sjekk på
 *     nytt** after a retry that worked, **Grunngje på nytt** behind its dialog), never `body` (UD-006, WCAG 2.4.3).
 *   - One request at a time: while unpublishing, the button is `aria-disabled` (it keeps focus) and presses do nothing.
 *   - Outcomes are announced in a polite status region; failures in an alert.
 * Collaborators: ../../components/FindingsList.tsx, ../../components/PublishDialog.tsx, ../../api/contentApi.ts,
 *   ../../components/useAnnouncement.ts, ./useMainActionFocus.ts, ./tabs/CheckTab.tsx, ./ActivityView.tsx.
 * Tests: apps/web/test/features/CheckPanel.test.tsx, apps/web/test/features/CheckPanelTransitions.test.tsx,
 *   apps/web/test/features/CheckPanelFocus.test.tsx
 */
'use client';

import type { ContentDetail, FindingsResponse } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getFindings, unpublishContent } from '../../api/contentApi';
import { FindingsList } from '../../components/FindingsList';
import { PublishDialog, unexplainedErrors } from '../../components/PublishDialog';
import { useAnnouncement } from '../../components/useAnnouncement';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useMainActionFocus, type FocusAfter } from './useMainActionFocus';

/** What the panel needs. */
export interface CheckPanelProps {
  readonly detail: ContentDetail;
  /** Changes after every save in the editor; the findings are fetched again. */
  readonly revision: number;
  readonly onGoToField: (path: string) => void;
  /** The status changed (published or draft): the page reloads the activity; the panel waits for it. */
  readonly onStatusChange: () => void | Promise<void>;
  /** A notice for the first-publish dialog, given the way to close it; it never takes part in publishing. */
  readonly publishNotice?: (closeDialog: () => void) => ReactNode;
}

type Findings = FindingsResponse | 'loading' | 'failed';
/** Which dialog is open: a first publish, new reasons for a published activity, or none (`null`). */
type DialogMode = 'publish' | 'renew' | null;

/**
 * The check-and-publish panel.
 * @param props - The activity, the save revision and the handlers.
 * @returns The panel's content.
 */
export function CheckPanel({
  detail,
  revision,
  onGoToField,
  onStatusChange,
  publishNotice,
}: CheckPanelProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [findings, setFindings] = useState<Findings>('loading');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [status, announce] = useAnnouncement();
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const { mainAction, requestFocus } = useMainActionFocus();
  const pending = useRef(false);
  const published = detail.status === 'published';
  // WHY: findings and status of one moment only (after a publish, the new status may come before the new findings).
  const renew =
    detail.mayPublish &&
    published &&
    typeof findings === 'object' &&
    findings.updatedAt === detail.updatedAt &&
    unexplainedErrors(findings.findings).length > 0;

  const load = useCallback(
    async (focus: FocusAfter = null) => {
      const result = await getFindings(detail.id, auth);
      if (result.ok && focus) requestFocus(focus);
      setFindings(result.ok ? result.data : 'failed');
    },
    [detail.id, auth, requestFocus],
  );

  useEffect(() => {
    let active = true;
    void getFindings(detail.id, auth).then((result) => {
      if (active) setFindings(result.ok ? result.data : 'failed');
    });
    return () => {
      active = false;
    };
  }, [detail.id, auth, revision]);

  const unpublish = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setProblem('');
    try {
      const updatedAt = typeof findings === 'object' ? findings.updatedAt : detail.updatedAt;
      const result = await unpublishContent(detail.id, { updatedAt }, auth);
      if (result.ok) announce(t('activity.unpublished', locale));
      else
        setProblem(
          result.error?.errorCode === 'hvl:content-changed'
            ? t('publish.changed', locale)
            : t('activity.unpublishFailed', locale),
        );
      await Promise.all([onStatusChange(), load()]);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  // A11Y: focus goes to the main action after a publish, and after a retry or a closed dialog if its control has gone.
  const retry = () => void load('ifLost');
  const closeDialog = (focus: FocusAfter = 'ifLost') => {
    requestFocus(focus);
    setDialog(null);
  };
  const afterPublish = () => {
    announce(t(dialog === 'renew' ? 'publish.renewed' : 'publish.published', locale));
    closeDialog('always');
    setProblem('');
    void Promise.all([onStatusChange(), load()]);
  };

  return (
    <div>
      <h2>{t('findings.heading', locale)}</h2>
      <p role="status">{status}</p>
      {problem ? <p role="alert">{problem}</p> : null}
      {findings === 'loading' ? <p>{t('activity.checking', locale)}</p> : null}
      {findings === 'failed' ? (
        <p role="alert">
          {t('activity.checkFailed', locale)}{' '}
          <button type="button" className="button-secondary" onClick={retry}>
            {t('activity.checkAgain', locale)}
          </button>
        </p>
      ) : null}
      {typeof findings === 'object' ? (
        <>
          <FindingsList
            findings={findings.findings}
            onGoToField={onGoToField}
            canGoToField={detail.mayEdit}
          />
          {renew ? <p>{t('publish.renewNeeded', locale)}</p> : null}
          <div className="flex flex-wrap gap-2">
            {renew ? (
              <button type="button" className="button-primary" onClick={() => setDialog('renew')}>
                {t('publish.renewOpen', locale)}
              </button>
            ) : null}
            {detail.mayPublish ? (
              <button
                ref={mainAction}
                type="button"
                className={published ? 'button-secondary' : 'button-primary'}
                aria-disabled={busy || undefined}
                onClick={() => (published ? void unpublish() : pending.current || setDialog('publish'))}
              >
                {t(published ? 'activity.unpublish' : 'publish.open', locale)}
              </button>
            ) : null}
          </div>
          <PublishDialog
            contentId={detail.id}
            open={dialog !== null}
            renew={dialog === 'renew'}
            findings={findings}
            onClose={() => closeDialog()}
            onPublished={afterPublish}
            onStale={() => void Promise.all([onStatusChange(), load()])}
            onFindings={(current) => setFindings({ updatedAt: findings.updatedAt, findings: [...current] })}
            notice={dialog === 'publish' ? publishNotice?.(() => closeDialog()) : undefined}
          />
        </>
      ) : null}
    </div>
  );
}
