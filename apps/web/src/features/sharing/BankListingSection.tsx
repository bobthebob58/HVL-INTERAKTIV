/**
 * BankListingSection — an activity's place in the HVL content bank on the **Deling** tab: whether it is listed, what
 * listing it needs, the consent text, and the owner's list and unlist buttons.
 *
 * Why: PROD-007 lets an author share an activity with colleagues through the bank (D-091 as amended). Listing is
 *      opt-in by the owner after reading a consent text (a draft for ALU's and HVL's legal review), and needs a
 *      published activity shared with HVL or wider whose owner is HVL staff; the server decides and says `eligible`.
 * Spec: PROD-007, UD-006, UD-013, UD-003
 * Invariants:
 *   - The list button sends the consent text's version (`BANK_CONSENT_VERSION`) only once the box is ticked; without
 *     it the button shows a problem next to the box and focuses it (WCAG 3.3.1).
 *   - When the activity may not be listed, the unmet conditions are listed in words (never colour alone); only the
 *     owner gets buttons, a co-author the state and why.
 *   - Each change is announced politely and the section shows the server's answer; the listing is read again when the
 *     activity's status or visibility changes (another tab, or a change to private, may have ended it).
 * Collaborators: ../../api/collaborationApi.ts, ./BankConditions.tsx, ./SharingFeedback.tsx, ./SharingPanel.tsx.
 * Tests: apps/web/test/features/BankListingSection.test.tsx
 */
'use client';

import type { BankListing, ContentDetail } from '@hvl-interaktiv/api-contract';
import { useEffect, useId, useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import type { ApiResult } from '../../api/apiRequest';
import { getBankListing, listInBank, unlistFromBank } from '../../api/collaborationApi';
import { formatDate } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { BankConditions } from './BankConditions';
import { SharingProblem } from './SharingFeedback';

/** The version of the consent text shown: the contract's `BANK_CONSENT_VERSION` (a test keeps the two equal). */
export const SHOWN_CONSENT_VERSION = 1;

/** What the section needs. */
export interface BankListingSectionProps {
  readonly detail: ContentDetail;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
}

/**
 * The bank state and, for the owner, the consent and the buttons.
 * @param props - The activity and the page's announcer.
 * @returns The section.
 */
export function BankListingSection({ detail, announce }: BankListingSectionProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const base = useId();
  const box = useRef<HTMLInputElement>(null);
  const [listing, setListing] = useState<BankListing | 'loading' | 'failed'>('loading');
  const [consented, setConsented] = useState(false);
  const [problem, setProblem] = useState<{ readonly text: string; readonly atBox?: boolean }>();
  const owner = detail.role === 'owner';

  useEffect(() => {
    let active = true;
    void getBankListing(detail.id, auth).then((result) => {
      if (active) setListing(result.ok ? result.data : 'failed');
    });
    return () => {
      active = false;
    };
    // WHY: the listing depends on the status and visibility, which other tabs change; read it again after each.
  }, [detail.id, detail.status, detail.visibility, auth]);

  const change = async (request: () => Promise<ApiResult<BankListing>>, said: string) => {
    setProblem(undefined);
    const result = await request();
    if (!result.ok) return setProblem({ text: result.error?.message ?? t('sharing.bankFailed', locale) });
    setListing(result.data);
    setConsented(false);
    announce(said);
  };
  const list = () => {
    if (!consented) {
      setProblem({ text: t('sharing.bankConsentRequired', locale), atBox: true });
      box.current?.focus();
      return;
    }
    void change(() => listInBank(detail.id, SHOWN_CONSENT_VERSION, auth), t('sharing.bankListedNow', locale));
  };

  if (listing === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (listing === 'failed') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  const listed = listing.listedAt !== null;
  return (
    <>
      <p>
        {listing.listedAt
          ? t('sharing.bankListed', locale, { date: formatDate(listing.listedAt, locale) })
          : t('sharing.bankNotListed', locale)}
      </p>
      {!owner ? <p>{t('sharing.bankOwnerOnly', locale)}</p> : null}
      {!listed && !listing.eligible ? <BankConditions detail={detail} /> : null}
      {owner && listed ? (
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            void change(() => unlistFromBank(detail.id, auth), t('sharing.bankUnlistedNow', locale))
          }
        >
          {t('sharing.bankUnlist', locale)}
        </button>
      ) : null}
      {owner && !listed && listing.eligible ? (
        <div className="mt-2 border-l-4 border-hvl-primary-dark bg-hvl-surface-alt p-3">
          <h4 className="m-0">{t('sharing.bankConsentHeading', locale)}</h4>
          <p>{t('sharing.bankConsent', locale)}</p>
          <p className="text-hvl-ink-muted">{t('sharing.bankConsentDraft', locale)}</p>
          <div className="flex items-center gap-2">
            <input
              ref={box}
              id={`${base}-consent`}
              type="checkbox"
              checked={consented}
              aria-describedby={problem?.atBox ? `${base}-consent-problem` : undefined}
              onChange={(event) => setConsented(event.target.checked)}
              className="min-h-target min-w-target"
            />
            <label htmlFor={`${base}-consent`}>{t('sharing.bankConsentCheckbox', locale)}</label>
          </div>
          <button type="button" className="button-primary mt-2" onClick={list}>
            {t('sharing.bankList', locale)}
          </button>
        </div>
      ) : null}
      {problem ? (
        <div id={problem.atBox ? `${base}-consent-problem` : undefined}>
          <SharingProblem text={problem.text} />
        </div>
      ) : null}
    </>
  );
}
