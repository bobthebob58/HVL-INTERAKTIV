/**
 * VisibilityControl — who can find an activity: only the owner and co-authors, everyone at HVL, or everyone with a
 * Feide login, chosen with radio buttons and saved with one button.
 *
 * Why: PROD-006 lets the owner and co-authors share an activity; until S5 the choice had only an API, and D-089 puts
 *      it on the **Deling** tab. The server decides who may change it (a student author only to private, D-059) and
 *      takes a private activity out of the content bank (D-091), so the page reloads the activity after a save.
 * Spec: PROD-006, PROD-007, UD-006, UD-013
 * Invariants:
 *   - The choice is saved only when the button is pressed, never on an arrow key (WCAG 3.2.2).
 *   - A refusal shows the server's message (e.g. `hvl:sharing-not-allowed`) with the ✗ icon; success is announced
 *     politely and shown with the ✓ icon (never colour alone, UD-003).
 *   - A11Y: each save clears the last outcome before it asks, so the same refusal twice is a new alert and is
 *     announced again (WCAG 4.1.3).
 * Collaborators: ../../api/collaborationApi.ts (`changeVisibility`), ./SharingFeedback.tsx, ./SharingPanel.tsx.
 * Tests: apps/web/test/features/SharingPanel.test.tsx
 */
'use client';

import type { ContentDetail, Visibility } from '@hvl-interaktiv/api-contract';
import { useId, useState, type FormEvent } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { changeVisibility } from '../../api/collaborationApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type MessageKey } from '../../i18n/translate';
import { SharingProblem, SharingSuccess } from './SharingFeedback';

/** The visibilities, in the order shown, with their labels. */
const CHOICES: readonly { readonly value: Visibility; readonly label: MessageKey }[] = [
  { value: 'private', label: 'sharing.visibilityPrivate' },
  { value: 'organisation', label: 'sharing.visibilityOrganisation' },
  { value: 'feide', label: 'sharing.visibilityFeide' },
];

/** What the control needs. */
export interface VisibilityControlProps {
  readonly detail: ContentDetail;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
  /** Loads the activity again after a change. */
  readonly reloadDetail: () => Promise<void>;
}

/**
 * The visibility fieldset and its save button.
 * @param props - The activity, the page's announcer and its reload.
 * @returns The form.
 */
export function VisibilityControl({ detail, announce, reloadDetail }: VisibilityControlProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const base = useId();
  const [chosen, setChosen] = useState<Visibility>(detail.visibility);
  const [outcome, setOutcome] = useState<'saved' | { readonly error: string } | undefined>();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    // WHY: an alert is announced when it appears or changes; a second identical refusal would change nothing.
    setOutcome(undefined);
    const result = await changeVisibility(detail.id, chosen, auth);
    if (!result.ok) {
      setOutcome({ error: result.error?.message ?? t('sharing.visibilityFailed', locale) });
      return;
    }
    setOutcome('saved');
    announce(t('sharing.visibilitySaved', locale));
    await reloadDetail();
  };
  return (
    <form onSubmit={(event) => void save(event)} className="mb-6">
      <fieldset className="m-0 mb-2 border-0 p-0" aria-describedby={`${base}-hint`}>
        <legend className="mb-1 text-lg font-bold">{t('sharing.visibilityLegend', locale)}</legend>
        <p id={`${base}-hint`} className="m-0 text-hvl-ink-muted">
          {t('sharing.visibilityHint', locale)}
        </p>
        {CHOICES.map((choice) => (
          <div key={choice.value} className="mt-1 flex items-center gap-2">
            <input
              type="radio"
              id={`${base}-${choice.value}`}
              name={`${base}-visibility`}
              value={choice.value}
              checked={chosen === choice.value}
              onChange={() => setChosen(choice.value)}
              className="min-h-target min-w-target"
            />
            <label htmlFor={`${base}-${choice.value}`}>{t(choice.label, locale)}</label>
          </div>
        ))}
      </fieldset>
      <button type="submit" className="button-secondary">
        {t('sharing.visibilitySave', locale)}
      </button>
      {outcome === 'saved' ? <SharingSuccess text={t('sharing.visibilitySaved', locale)} /> : null}
      {typeof outcome === 'object' ? <SharingProblem text={outcome.error} /> : null}
    </form>
  );
}
