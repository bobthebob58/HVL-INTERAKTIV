/**
 * BankWorkspace — the content bank for a signed-in author: the entries colleagues listed, newest first, or why the
 * person may not see them.
 *
 * Why: PROD-007 lets HVL staff find colleagues' activities to copy (D-091). The server decides who may read the bank:
 *      a student author is refused with `hvl:sharing-not-allowed`, which this page explains in its own words (the
 *      bank shows colleagues' names, which /personvern tells only staff); everyone else refused gets a plain refusal.
 * Spec: PROD-007, PED-001, UD-013
 * Invariants:
 *   - The phase labels come from `GET /api/studio` (the studio content, PED-001), never from this file; when they
 *     cannot be read, the entries show without a phase.
 *   - The count is plain text, not a live region: it is read with the page, which changes only when it loads.
 *   - An empty bank says so; a refusal or a failure is an alert.
 * Collaborators: ./BankView.tsx, ./BankEntryCard.tsx, ../../api/collaborationApi.ts (`getBank`),
 *   ../../api/learningDesignApi.ts (`getStudioPhases`).
 * Tests: apps/web/test/features/BankView.test.tsx, apps/web/test/features/studioPages.test.tsx
 */
'use client';

import type { BankList, StudioOverview } from '@hvl-interaktiv/api-contract';
import { useEffect, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getBank } from '../../api/collaborationApi';
import { getStudioPhases } from '../../api/learningDesignApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { BankEntryCard } from './BankEntryCard';

type BankState = BankList | 'loading' | 'student' | 'refused' | 'failed';

/**
 * The bank's entries, or why there are none to show.
 * @param props - The navigation for «Lag ein kopi» (the browser's own by default).
 * @returns The workspace.
 */
export function BankWorkspace({ navigate }: { readonly navigate?: (path: string) => void }) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [bank, setBank] = useState<BankState>('loading');
  const [overview, setOverview] = useState<StudioOverview>();

  useEffect(() => {
    let active = true;
    void getBank(auth).then((result) => {
      if (!active) return;
      if (result.ok) setBank(result.data);
      else if (result.status === 403 && result.error?.errorCode === 'hvl:sharing-not-allowed')
        setBank('student');
      else setBank(result.status === 403 ? 'refused' : 'failed');
    });
    void getStudioPhases(auth).then((result) => {
      if (active && result.ok) setOverview(result.data);
    });
    return () => {
      active = false;
    };
  }, [auth]);

  if (bank === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (bank === 'student') return <p role="alert">{t('bank.studentRefused', locale)}</p>;
  if (bank === 'refused') return <p role="alert">{t('bank.refused', locale)}</p>;
  if (bank === 'failed') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  const phaseLabel = (key: string | undefined) =>
    overview?.phases.find((phase) => phase.key === key)?.label[locale];
  return (
    <>
      <p>{t('bank.intro', locale)}</p>
      {bank.items.length === 0 ? (
        <p>{t('bank.empty', locale)}</p>
      ) : (
        <>
          <p>{t('bank.count', locale, { count: bank.items.length })}</p>
          {bank.items.map((entry) => {
            const label = phaseLabel(entry.phase);
            return (
              <BankEntryCard
                key={entry.contentId}
                entry={entry}
                {...(label ? { phaseLabel: label } : {})}
                {...(navigate ? { navigate } : {})}
              />
            );
          })}
        </>
      )}
    </>
  );
}
