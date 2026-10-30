/**
 * DuplicateButton — «Lag ein kopi»: copies an activity as the person's own private draft and opens the copy's
 * **Rediger** tab.
 *
 * Why: PROD-007 lets an author copy their own activity or a colleague's from the content bank and adapt it (D-092).
 *      The server decides who may copy and makes the copy; this button sends the request, says what happens and
 *      opens the copy, where its source is shown (../activity/SourceAttributionNote.tsx).
 * Spec: PROD-007, UD-006, UD-013
 * Invariants:
 *   - A11Y: one request at a time: while it runs the button is `aria-disabled` (still focusable), the line under it
 *     says so, and the page's one polite status region announces it (WCAG 4.1.3); a second press does nothing.
 *   - A11Y: the button has no live region of its own: a page with many buttons (the bank, one per card) would
 *     otherwise hold as many empty status regions, which some screen readers list or read out of turn.
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
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
  /** Opens a page; the browser's own navigation by default. */
  readonly navigate?: (path: string) => void;
}

/**
 * The «Lag ein kopi» button and the line under it that says what happens.
 * @param props - The activity, an optional accessible name, the page's announcer and the navigation.
 * @returns The button.
 */
export function DuplicateButton({
  contentId,
  accessibleName,
  announce,
  navigate = (path: string) => window.location.assign(path),
}: DuplicateButtonProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | { readonly error: string }>('idle');

  const copy = async () => {
    if (state === 'busy' || state === 'done') return;
    setState('busy');
    announce(t('sharing.duplicating', locale));
    const result = await duplicateContent(contentId, auth);
    if (!result.ok) {
      setState({ error: result.error?.message ?? t('sharing.duplicateFailed', locale) });
      return;
    }
    setState('done');
    announce(t('sharing.duplicated', locale));
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
      <p className="m-0 min-h-6">{status}</p>
      {typeof state === 'object' ? <SharingProblem text={state.error} /> : null}
    </div>
  );
}
