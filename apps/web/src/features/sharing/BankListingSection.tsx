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
 *     activity's status or visibility changes (another tab, or a change to private, may have ended it). The server may
 *     handle a read before or after a change sent earlier, so a re-read asked for while changes are on their way is
 *     sent once the last of them has answered (a refused one too) and shows the state they left, and a re-read sent
 *     before a change is dropped once a later request's answer is shown: a re-read never replaces a later request's
 *     answer. Changes that overlap (a second press before the first answer) show their answers as they arrive.
 *   - A11Y: the pressed button is gone after a change, so once its answer has rendered (the effect of the commit that
 *     renders the request, never an earlier commit's effect or a timer), focus the change took away moves to «Ta ut av
 *     innhaldsbanken» after listing and to the state sentence after unlisting; focus the person has moved elsewhere,
 *     e.g. to save the visibility, stays there (WCAG 2.4.3).
 * Collaborators: ../../api/collaborationApi.ts, ../../components/useFocusAfterChange.ts, ./BankConditions.tsx,
 *   ./SharingFeedback.tsx, ./SharingPanel.tsx.
 * Tests: apps/web/test/features/BankListingSection.test.tsx, apps/web/test/features/BankListingOrder.test.tsx,
 *   apps/web/test/features/sharingFocusRace.test.tsx
 */
'use client';

import type { BankListing, ContentDetail } from '@hvl-interaktiv/api-contract';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import type { ApiResult } from '../../api/apiRequest';
import { getBankListing, listInBank, unlistFromBank } from '../../api/collaborationApi';
import { useFocusAfterChange } from '../../components/useFocusAfterChange';
import { formatDate } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { BankConditions } from './BankConditions';
import { SharingProblem } from './SharingFeedback';

/** The version of the consent text shown: the contract's `BANK_CONSENT_VERSION` (a test keeps the two equal). */
export const SHOWN_CONSENT_VERSION = 1;

/** A focus step for `focusAfter` that focuses `target` only if focus was lost (nothing, or `body`, has it). */
const focusIfLost = (target: RefObject<HTMLElement | null>) => () => {
  // A11Y: WCAG 2.4.3: the pressed button is gone, so focus moves on; someone who moved elsewhere while the change was
  // on its way keeps their place (as `'ifLost'` in ../activity/useMainActionFocus.ts).
  if (!document.activeElement || document.activeElement === document.body) target.current?.focus();
};

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
  const unlistButton = useRef<HTMLButtonElement>(null);
  const stateText = useRef<HTMLParagraphElement>(null);
  const [listing, setListing] = useState<BankListing | 'loading' | 'failed'>('loading');
  const [consented, setConsented] = useState(false);
  const [problem, setProblem] = useState<{ readonly text: string; readonly atBox?: boolean }>();
  // A11Y: WCAG 2.4.3: each focus waits for the commit that renders it with the answer, so the control to focus is on
  // screen; neither a 0 ms timer (Chromium) nor the late effect of a re-read that rendered first may run it.
  const focusAfter = useFocusAfterChange();
  // WHY: answers may arrive out of order; each request takes the next number when sent (`sent`), `shown` is the
  // highest number whose answer is shown, `changing` counts changes on their way, `waiting` marks a waiting re-read.
  const order = useRef({ sent: 0, shown: 0, changing: 0, waiting: false });
  const [rereads, setRereads] = useState(0);
  const owner = detail.role === 'owner';

  useEffect(() => {
    // WHY: the server may handle a read sent now before or after a change on its way; it waits until all have answered.
    if (order.current.changing > 0) {
      order.current.waiting = true;
      return;
    }
    let active = true;
    const asked = ++order.current.sent;
    void getBankListing(detail.id, auth).then((result) => {
      // WHY: a re-read sent before a change may have been read on the server before it; once a later request's
      // answer is shown, this one is older and would undo the change on screen (and remove the focused button).
      if (!active || asked < order.current.shown) return;
      order.current.shown = asked;
      setListing(result.ok ? result.data : 'failed');
    });
    return () => {
      active = false;
    };
    // WHY: the listing depends on the status and visibility, which other tabs change; read it again after each, and
    // when a read waited for a change (`rereads`).
  }, [detail.id, detail.status, detail.visibility, auth, rereads]);

  const change = async (request: () => Promise<ApiResult<BankListing>>, said: string, focus: () => void) => {
    setProblem(undefined);
    const now = order.current;
    const asked = ++now.sent;
    now.changing += 1;
    const result = await request();
    now.changing -= 1;
    if (now.changing === 0 && now.waiting) {
      now.waiting = false;
      setRereads((count) => count + 1);
    }
    if (!result.ok) return setProblem({ text: result.error?.message ?? t('sharing.bankFailed', locale) });
    now.shown = Math.max(now.shown, asked);
    focusAfter(focus);
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
    void change(
      () => listInBank(detail.id, SHOWN_CONSENT_VERSION, auth),
      t('sharing.bankListedNow', locale),
      focusIfLost(unlistButton),
    );
  };

  if (listing === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (listing === 'failed') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  const listed = listing.listedAt !== null;
  return (
    <>
      <p ref={stateText} tabIndex={-1}>
        {listing.listedAt
          ? t('sharing.bankListed', locale, { date: formatDate(listing.listedAt, locale) })
          : t('sharing.bankNotListed', locale)}
      </p>
      {!owner ? <p>{t('sharing.bankOwnerOnly', locale)}</p> : null}
      {!listed && !listing.eligible ? <BankConditions detail={detail} /> : null}
      {owner && listed ? (
        <button
          ref={unlistButton}
          type="button"
          className="button-secondary"
          onClick={() =>
            void change(
              () => unlistFromBank(detail.id, auth),
              t('sharing.bankUnlistedNow', locale),
              focusIfLost(stateText),
            )
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
