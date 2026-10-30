/**
 * BankConditions — why an activity may not be listed in the content bank yet, in words: what must be in place.
 *
 * Why: D-091 (as amended) lists an activity only when it is published, shared with HVL or wider, and owned by HVL
 *      staff. The server answers `eligible: false` without a reason; the page knows the status and the visibility,
 *      so it names those, and names the owner's condition only when both are met (then it is the reason).
 * Spec: PROD-007, UD-013
 * Invariants:
 *   - Only conditions known to be unmet are listed; the list is never empty (the owner's condition stands last).
 * Collaborators: ./BankListingSection.tsx.
 * Tests: apps/web/test/features/BankListingSection.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type MessageKey } from '../../i18n/translate';

/**
 * The conditions an activity does not meet, as locale keys.
 * @param detail - The activity's status and visibility.
 * @returns The unmet conditions, in the order of D-091.
 */
export function unmetBankConditions(detail: Pick<ContentDetail, 'status' | 'visibility'>): MessageKey[] {
  const unmet: MessageKey[] = [];
  if (detail.status !== 'published') unmet.push('sharing.bankNeedsPublished');
  if (detail.visibility === 'private') unmet.push('sharing.bankNeedsShared');
  if (unmet.length === 0) unmet.push('sharing.bankNeedsStaff');
  return unmet;
}

/**
 * The lead and the list of unmet conditions.
 * @param props - The activity.
 * @returns The explanation.
 */
export function BankConditions({ detail }: { readonly detail: ContentDetail }) {
  const locale = useLocale();
  return (
    <>
      <p className="mb-1">{t('sharing.bankNotEligible', locale)}</p>
      <ul className="m-0 pl-6">
        {unmetBankConditions(detail).map((key) => (
          <li key={key}>{t(key, locale)}</li>
        ))}
      </ul>
    </>
  );
}
