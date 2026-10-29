/**
 * DuplicateButton — «Lag ein kopi»: copies an activity as the person's own private draft and opens the copy's
 * **Rediger** tab.
 *
 * Why: PROD-007 lets an author copy their own activity or a colleague's from the content bank and adapt it (D-092).
 *      The server decides who may copy and makes the copy; this button sends the request, says what happens and
 *      opens the copy, where its source is shown (../activity/SourceAttributionNote.tsx).
 * Spec: PROD-007, UD-006, UD-013
 * Invariants:
 *   - A11Y: one request at a time: while it runs the button is `aria-disabled` (still focusable) and the status says
 *     so (WCAG 4.1.3); a second press does nothing.
 *   - A11Y: `accessibleName` names the activity when several buttons share a page (the bank: «Lag ein kopi av …»,
 *     WCAG 2.4.6).
 *   - A refusal shows the server's own message, else a plain one, with the ✗ icon (never colour alone, UD-003).
 * Collaborators: ../../api/collaborationApi.ts (`duplicateContent`), ../../api/ApiAuthContext.tsx,
 *   ../../config/paths.ts (`activityPath`), ./SharingFeedback.tsx, ./SharingPanel.tsx, ../bank/BankEntryCard.tsx.
 * Tests: apps/web/test/features/SharingPanel.test.tsx, apps/web/test/features/BankView.test.tsx
 */
'use client';

import { useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { duplicateContent } from '../../api/collaborationApi';
import { activityPath } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { EDIT_TAB_ID } from '../activity/tabs/EditTab';
import { SharingProblem } from './SharingFeedback';

/** What the button needs. */
export interface DuplicateButtonProps {
  /** The activity to copy. */
  readonly contentId: string;
  /** The button's accessible name when the visible «Lag ein kopi» is not enough, e.g. «Lag ein kopi av Celler». */
  readonly accessibleName?: string;
  /** Opens a page; the browser's own navigation by default. */
  readonly navigate?: (path: string) => void;
}

/**
 * The «Lag ein kopi» button and its status line.
 * @param props - The activity, an optional accessible name and the navigation.
 * @returns The button.
 */
export function DuplicateButton({
  contentId,
  accessibleName,
  navigate = (path: string) => window.location.assign(path),
}: DuplicateButtonProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | { readonly error: string }>('idle');

  const copy = async () => {
    if (state === 'busy' || state === 'done') return;
    setState('busy');
    const result = await duplicateContent(contentId, auth);
    if (!result.ok) {
      setState({ error: result.error?.message ?? t('sharing.duplicateFailed', locale) });
      return;
    }
    setState('done');
    navigate(activityPath(result.data.contentId, EDIT_TAB_ID));
  };
  const busy = state === 'busy' || state === 'done';
  const status =
    state === 'busy'
      ? t('sharing.duplicating', locale)
      : state === 'done'
        ? t('sharing.duplicated', locale)
        : '';
  return (
    <div className="mt-2">
      <button
        type="button"
        className="button-secondary"
        aria-label={accessibleName}
        aria-disabled={busy || undefined}
        onClick={() => void copy()}
      >
        {t('sharing.duplicate', locale)}
      </button>
      <p role="status" className="m-0 min-h-6">
        {status}
      </p>
      {typeof state === 'object' ? <SharingProblem text={state.error} /> : null}
    </div>
  );
}
