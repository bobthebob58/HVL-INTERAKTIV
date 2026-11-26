/**
 * ConfirmDialog — asks before an action that takes something away: a question, what it means, the action's button
 * and «Avbryt».
 *
 * Why: a control that acts at once on one press can be pressed by mistake, and a page shown under something else
 *      could have it pressed without the person knowing (D-125). Going back to draft, removing a co-author and
 *      taking an activity out of the content bank each change what other people can see or do, so they ask first.
 * Spec: UD-006, PROD-007
 * Invariants:
 *   - Nothing happens before the person presses the action's button in the dialog; «Avbryt», «Lukk» and Escape close
 *     it and do nothing else.
 *   - A11Y: it is ./Dialog.tsx: focus moves in, stays in, and returns to the control that opened it; the question is
 *     the dialog's name, read first.
 * Collaborators: ./Dialog.tsx, ../features/activity/CheckPanel.tsx, ../features/sharing/CoAuthorSection.tsx,
 *   ../features/sharing/BankUnlistButton.tsx.
 * Tests: apps/web/test/features/AskBeforeActing.test.tsx
 */
'use client';

import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n/translate';
import { Dialog } from './Dialog';

/** What the question needs. */
export interface ConfirmDialogProps {
  readonly open: boolean;
  /** The question; the dialog's name. */
  readonly question: string;
  /** What the action means for others. */
  readonly consequence: string;
  /** The text of the button that does it. */
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * A question before an action.
 * @param props - Whether it is open, its texts and the two answers.
 * @returns The dialog, or nothing while closed.
 */
export function ConfirmDialog({
  open,
  question,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const locale = useLocale();
  return (
    <Dialog open={open} title={question} onClose={onCancel}>
      <p>{consequence}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="button-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          {t('common.cancel', locale)}
        </button>
      </div>
    </Dialog>
  );
}
