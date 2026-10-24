/**
 * CheckPanel — the **Sjekk og publiser** tab: the validator's findings for the stored activity, publishing through
 * the publish dialog, and returning a published activity to draft.
 *
 * Why: PROD-003 runs the universal design validator and the pedagogical hints before publishing and lists the
 *      findings with *Go to field*. The findings belong to one `updatedAt` (D-074): they are fetched again after every
 *      save (`revision`), after publishing or unpublishing, and whenever the server says the activity changed.
 * Spec: PROD-003, UD-022, UD-013
 * Invariants:
 *   - Publishing always sends the `updatedAt` of the findings on screen; unpublishing the same.
 *   - Outcomes are announced in a polite status region; failures in an alert.
 * Collaborators: ../../components/FindingsList.tsx, ../../components/PublishDialog.tsx, ../../api/contentApi.ts,
 *   ./ActivityView.tsx.
 * Tests: apps/web/test/features/CheckPanel.test.tsx
 */
'use client';

import type { ContentDetail, FindingsResponse } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getFindings, unpublishContent } from '../../api/contentApi';
import { FindingsList } from '../../components/FindingsList';
import { PublishDialog } from '../../components/PublishDialog';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the panel needs. */
export interface CheckPanelProps {
  readonly detail: ContentDetail;
  /** Changes after every save in the editor; the findings are fetched again. */
  readonly revision: number;
  readonly onGoToField: (path: string) => void;
  /** The status changed (published or draft): the page reloads the activity. */
  readonly onStatusChange: () => void;
}

type Findings = FindingsResponse | 'loading' | 'failed';

/**
 * The check-and-publish panel.
 * @param props - The activity, the save revision and the handlers.
 * @returns The panel's content.
 */
export function CheckPanel({ detail, revision, onGoToField, onStatusChange }: CheckPanelProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [findings, setFindings] = useState<Findings>('loading');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState('');

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

  const unpublish = async () => {
    setProblem('');
    const updatedAt = typeof findings === 'object' ? findings.updatedAt : detail.updatedAt;
    const result = await unpublishContent(detail.id, { updatedAt }, auth);
    if (result.ok) setStatus(t('activity.unpublished', locale));
    else
      setProblem(
        result.error?.errorCode === 'hvl:content-changed'
          ? t('publish.changed', locale)
          : t('activity.unpublishFailed', locale),
      );
    onStatusChange();
    await load();
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
          <div className="flex flex-wrap gap-2">
            {detail.mayPublish && detail.status !== 'published' ? (
              <button type="button" className="button-primary" onClick={() => setDialogOpen(true)}>
                {t('publish.open', locale)}
              </button>
            ) : null}
            {detail.mayPublish && detail.status === 'published' ? (
              <button type="button" className="button-secondary" onClick={() => void unpublish()}>
                {t('activity.unpublish', locale)}
              </button>
            ) : null}
          </div>
          <PublishDialog
            contentId={detail.id}
            open={dialogOpen}
            findings={findings}
            onClose={() => setDialogOpen(false)}
            onPublished={() => {
              setDialogOpen(false);
              setProblem('');
              setStatus(t('publish.published', locale));
              onStatusChange();
              void load();
            }}
            onStale={() => void load()}
            onFindings={(current) => setFindings({ updatedAt: findings.updatedAt, findings: [...current] })}
          />
        </>
      ) : null}
    </div>
  );
}
