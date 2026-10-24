/**
 * CheckPanel — the **Sjekk og publiser** tab: the validator's findings for the stored activity, publishing through
 * the publish dialog, a new reason for a published activity with an error that has no reason that holds, and the way
 * back to draft.
 *
 * Why: PROD-003 runs the universal design validator and the pedagogical hints before publishing and lists the
 *      findings with *Go to field*. The findings belong to one `updatedAt` (D-074): they are fetched again after every
 *      save (`revision`), after publishing or unpublishing, and whenever the server says the activity changed. A reason
 *      holds for 14 days, and an error found by a later rule never had one; while such an error stays, every save of
 *      the published activity is refused, and the way to give a reason is to publish the published activity again
 *      (D-074 W3 amendment), so the dialog is offered again for exactly that case. The findings show both cases as
 *      `acknowledgement: null`, so the note names neither.
 * Spec: PROD-003, UD-022, UD-013, UD-006
 * Invariants:
 *   - Publishing always sends the `updatedAt` of the findings on screen; unpublishing the same.
 *   - A published activity offers the dialog (**Grunngje på nytt**) only while an error has no reason that holds;
 *     with nothing to explain it offers only the way back to draft.
 *   - **Publiser** (draft) and **Gjer om til utkast** (published) are one button element, so focus stays on it when
 *     the status changes; after a successful publish focus is put on it again (UD-006, WCAG 2.4.3).
 *   - One request at a time: while unpublishing, the button is `aria-disabled` (it keeps focus) and presses do nothing.
 *   - Outcomes are announced in a polite status region; failures in an alert.
 * Collaborators: ../../components/FindingsList.tsx, ../../components/PublishDialog.tsx, ../../api/contentApi.ts,
 *   ../../components/useAnnouncement.ts, ./ActivityView.tsx.
 * Tests: apps/web/test/features/CheckPanel.test.tsx, apps/web/test/features/CheckPanelTransitions.test.tsx
 */
'use client';

import type { ContentDetail, FindingsResponse } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getFindings, unpublishContent } from '../../api/contentApi';
import { FindingsList } from '../../components/FindingsList';
import { PublishDialog, unexplainedErrors } from '../../components/PublishDialog';
import { useAnnouncement } from '../../components/useAnnouncement';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the panel needs. */
export interface CheckPanelProps {
  readonly detail: ContentDetail;
  /** Changes after every save in the editor; the findings are fetched again. */
  readonly revision: number;
  readonly onGoToField: (path: string) => void;
  /** The status changed (published or draft): the page reloads the activity; the panel waits for it. */
  readonly onStatusChange: () => void | Promise<void>;
}

type Findings = FindingsResponse | 'loading' | 'failed';
/** Which dialog is open: a first publish, new reasons for a published activity, or none (`null`). */
type DialogMode = 'publish' | 'renew' | null;

/**
 * The check-and-publish panel.
 * @param props - The activity, the save revision and the handlers.
 * @returns The panel's content.
 */
export function CheckPanel({ detail, revision, onGoToField, onStatusChange }: CheckPanelProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [findings, setFindings] = useState<Findings>('loading');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [status, announce] = useAnnouncement();
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const focusMain = useRef(false);
  const pending = useRef(false);
  const mainAction = useRef<HTMLButtonElement>(null);
  const published = detail.status === 'published';
  // WHY: findings and status of the same moment only; right after a publish the reloaded status may arrive before the
  // reloaded findings, whose errors were unexplained until that publish.
  const renew =
    detail.mayPublish &&
    published &&
    typeof findings === 'object' &&
    findings.updatedAt === detail.updatedAt &&
    unexplainedErrors(findings.findings).length > 0;

  const load = useCallback(async () => {
    const result = await getFindings(detail.id, auth);
    setFindings(result.ok ? result.data : 'failed');
  }, [detail.id, auth]);

  useEffect(() => {
    let active = true;
    void getFindings(detail.id, auth).then((result) => {
      if (active) setFindings(result.ok ? result.data : 'failed');
    });
    return () => {
      active = false;
    };
  }, [detail.id, auth, revision]);

  useEffect(() => {
    if (!focusMain.current) return;
    focusMain.current = false;
    // A11Y: WCAG 2.4.3: runs after the dialog returned focus to its opener; **Grunngje på nytt** goes away once every
    // error has a reason, so focus moves to the main action, which stays.
    mainAction.current?.focus();
  });

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

  const onMainAction = () => {
    if (published) void unpublish();
    else if (!pending.current) setDialog('publish');
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
          <button type="button" className="button-secondary" onClick={() => void load()}>
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
                onClick={onMainAction}
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
            onClose={() => setDialog(null)}
            onPublished={() => {
              announce(t(dialog === 'renew' ? 'publish.renewed' : 'publish.published', locale));
              focusMain.current = true;
              setDialog(null);
              setProblem('');
              void Promise.all([onStatusChange(), load()]);
            }}
            onStale={() => void load()}
            onFindings={(current) => setFindings({ updatedAt: findings.updatedAt, findings: [...current] })}
          />
        </>
      ) : null}
    </div>
  );
}
