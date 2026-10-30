/**
 * MinutesField — the **Læringsdesign** tab's estimate of the minutes students need: a short text field for a whole
 * number, with a hint and its problem.
 *
 * Why: PED-032 shows learners the estimated time before they start; D-087 allows 1–600 whole minutes. A text field
 *      with `inputMode="numeric"` gives a number keyboard on phones without the spin buttons and silent rounding of
 *      `type="number"`, and the form checks the value itself (./learningDesignForm.ts).
 * Spec: PED-030, PED-032, UD-013
 * Invariants:
 *   - The hint and the problem describe the field (`aria-describedby`); the problem has the ✗ icon and text.
 * Collaborators: ./LearningDesignFormView.tsx, ../../components/ErrorSummary.tsx.
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import { ERROR_ICON, fieldErrorId } from '../../components/ErrorSummary';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { MINUTES_MAX } from './learningDesignForm';

/** What the field needs. */
export interface MinutesFieldProps {
  /** The field's `id`; the error summary links to it. */
  readonly id: string;
  /** As typed. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}

/**
 * The minutes field.
 * @param props - Identity, value and problem.
 * @returns The labelled field with its hint and problem.
 */
export function MinutesField({ id, value, onChange, error }: MinutesFieldProps) {
  const locale = useLocale();
  const hintId = `${id}-hint`;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-bold">
        {t('learningDesign.minutesLabel', locale)}
      </label>
      <p id={hintId} className="m-0 text-hvl-ink-muted">
        {t('learningDesign.minutesHint', locale, { max: MINUTES_MAX })}
      </p>
      {error ? (
        <p id={fieldErrorId(id)} className="m-0 font-bold text-hvl-feedback-incorrect-fg">
          <span aria-hidden="true">{ERROR_ICON} </span>
          {error}
        </p>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, ...(error ? [fieldErrorId(id)] : [])].join(' ')}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 block w-24 rounded border-2 bg-hvl-surface p-2 ${
          error ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-ink-muted'
        }`}
      />
    </div>
  );
}
