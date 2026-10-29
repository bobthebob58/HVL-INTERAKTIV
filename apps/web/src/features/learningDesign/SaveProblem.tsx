/**
 * SaveProblem — why the **Læringsdesign** tab's save did not go through: a colleague saved meanwhile (with the way to
 * load what is stored), or the server's own message.
 *
 * Why: D-087 guards the full replace with the `updatedAt` the form was made from; a stale one is 409
 *      `hvl:learning-design-conflict`. The author must learn in plain language that nothing was saved and what the
 *      choice costs, and keep what they typed until they choose (WCAG 3.3.1).
 * Spec: PED-030, UD-013, UD-003
 * Invariants:
 *   - An alert with the ✗ icon (hidden from screen readers) and a text, never colour alone.
 *   - Only the conflict offers «Hent det som er lagra»; any other problem shows the server's translated message.
 * Collaborators: ./LearningDesignFormView.tsx, ../../components/ErrorSummary.tsx (`ERROR_ICON`).
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import { ERROR_ICON } from '../../components/ErrorSummary';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** Why a save failed: a conflict, or the server's message. */
export type SaveProblemKind = 'conflict' | { readonly message: string };

/**
 * The save problem.
 * @param props - The problem and what loading the stored version does.
 * @returns The alert.
 */
export function SaveProblem({
  problem,
  onLoadStored,
}: {
  readonly problem: SaveProblemKind;
  readonly onLoadStored: () => void;
}) {
  const locale = useLocale();
  return (
    <div role="alert" className="mb-4 border-l-4 border-hvl-feedback-incorrect-border p-3">
      <p className="m-0 font-bold">
        <span aria-hidden="true">{ERROR_ICON} </span>
        {problem === 'conflict' ? t('learningDesign.conflict', locale) : problem.message}
      </p>
      {problem === 'conflict' ? (
        <button type="button" className="button-secondary mt-2" onClick={onLoadStored}>
          {t('learningDesign.reloadStored', locale)}
        </button>
      ) : null}
    </div>
  );
}
