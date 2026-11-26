/**
 * BankUnlistButton — «Ta ut av innhaldsbanken», which asks before it takes the activity out.
 *
 * Why: unlisting changes what colleagues find at once; it asks first, so one press, by mistake or under something
 *      else, changes nothing (D-125). The button and its question are one small part of ./BankListingSection.tsx.
 * Spec: PROD-007, UD-006
 * Invariants:
 *   - `onConfirm` runs only after the person presses the action in the question; «Avbryt», «Lukk» and Escape close
 *     the question and nothing else happens.
 *   - A11Y: the button keeps the caller's ref, so the section's focus handling finds it as before.
 * Collaborators: ./BankListingSection.tsx (the only caller), ../../components/ConfirmDialog.tsx.
 * Tests: apps/web/test/features/BankListingSection.test.tsx, apps/web/test/features/AskBeforeActing.test.tsx
 */
'use client';

import { useState, type RefObject } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the button needs. */
export interface BankUnlistButtonProps {
  /** The section's handle on the button, for focus after a listing. */
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  /** Takes the activity out of the content bank. */
  readonly onConfirm: () => void;
}

/**
 * The unlist button with its question.
 * @param props - The button's ref and what confirming does.
 * @returns The button and, while asked, the question.
 */
export function BankUnlistButton({ buttonRef, onConfirm }: BankUnlistButtonProps) {
  const locale = useLocale();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button ref={buttonRef} type="button" className="button-secondary" onClick={() => setAsking(true)}>
        {t('sharing.bankUnlist', locale)}
      </button>
      <ConfirmDialog
        open={asking}
        question={t('sharing.bankUnlistQuestion', locale)}
        consequence={t('sharing.bankUnlistConsequence', locale)}
        confirmLabel={t('sharing.bankUnlist', locale)}
        onConfirm={() => (setAsking(false), onConfirm())}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
