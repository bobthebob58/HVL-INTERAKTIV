/**
 * confirmQuestion — answers the question a control asks before it acts (../../src/components/ConfirmDialog.tsx).
 *
 * Why: going back to draft, removing a co-author and unlisting from the content bank ask first (D-125); a test
 *      that is about what happens afterwards presses the control and then answers here.
 * Spec: UD-006, PROD-007
 * Invariants: the question must be open; the button is found inside the dialog, so the control behind it, which
 *   has the same text, is never the one pressed.
 * Tests: shared by apps/web/test/features/CheckPanel*.test.tsx, CoAuthorSection.test.tsx, BankListing*.test.tsx and
 *   sharingFocusRace.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';

/**
 * The button of the open question with this text.
 * @param label - The button's text: the action's, or «Avbryt».
 * @returns The button element.
 */
export const questionButton = (label: string): HTMLElement =>
  within(screen.getByRole('dialog')).getByRole('button', { name: label });

/**
 * Presses a button of the open question.
 * @param label - The button's text: the action's, or «Avbryt».
 */
export function confirmQuestion(label: string): void {
  fireEvent.click(questionButton(label));
}
