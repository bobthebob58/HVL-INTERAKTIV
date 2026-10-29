/**
 * SharingFeedback — the lines of feedback on the **Deling** tab and the bank page: a success with ✓, or a problem
 * with ✗, as an alert.
 *
 * Why: UD-003 and CLAUDE.md §1 never let feedback rest on colour alone; every outcome of sharing, co-authors, the bank
 *      and copying is said in words with an icon. One component keeps the icon, the role and the look the same.
 * Spec: UD-003, UD-013
 * Invariants:
 *   - The icon is decorative (`aria-hidden`); the text carries the meaning.
 *   - A problem is `role="alert"` (read at once); a success is plain text, because the page's status region
 *     announces it.
 * Collaborators: ../../components/ErrorSummary.tsx (`ERROR_ICON`), ./VisibilityControl.tsx, ./CoAuthorSection.tsx,
 *   ./BankListingSection.tsx, ./DuplicateButton.tsx.
 * Tests: apps/web/test/features/SharingPanel.test.tsx
 */
'use client';

import { ERROR_ICON } from '../../components/ErrorSummary';

/** The marker shown before a success (✓); the text carries the meaning. */
export const SUCCESS_ICON = '✓';

/**
 * A success, in words with ✓; the page's status region announces it.
 * @param props - The text.
 * @returns The line.
 */
export function SharingSuccess({ text }: { readonly text: string }) {
  return (
    <p className="m-0 mt-2">
      <span aria-hidden="true">{SUCCESS_ICON} </span>
      {text}
    </p>
  );
}

/**
 * A problem, in words with ✗, as an alert.
 * @param props - The text.
 * @returns The line.
 */
export function SharingProblem({ text }: { readonly text: string }) {
  return (
    <p role="alert" className="m-0 mt-2 font-bold text-hvl-feedback-incorrect-fg">
      <span aria-hidden="true">{ERROR_ICON} </span>
      {text}
    </p>
  );
}
