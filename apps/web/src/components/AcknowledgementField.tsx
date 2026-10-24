/**
 * AcknowledgementField — the reason an author gives for publishing despite one error, with its hint and problem.
 *
 * Why: PROD-003 and UD-022 let an author publish despite an error with a recorded reason of 1 to 500 characters. The
 *      field has a short label ("Grunngjeving for feil 1"); the error's message, the hint about the limit and the
 *      field's problem are its description (`aria-describedby`), so a screen reader reads the message once with the
 *      field instead of a label of several sentences (UD-013, WCAG 3.3.1, 3.3.3 and 2.4.6).
 * Spec: UD-022, UD-013
 * Invariants:
 *   - `aria-describedby` lists the message, the hint and, when there is one, the problem (`fieldErrorId`);
 *     `aria-invalid` then.
 *   - No `maxlength`: a pasted long reason is kept and reported, never cut silently.
 * Collaborators: ./PublishDialog.tsx, ./ErrorSummary.tsx (`fieldErrorId`).
 * Tests: apps/web/test/components/PublishDialog.test.tsx
 */
'use client';

import { fieldErrorId, ERROR_ICON } from './ErrorSummary';

/** What the field needs. */
export interface AcknowledgementFieldProps {
  /** The textarea's `id`; the error summary links to it. */
  readonly id: string;
  /** Short: which error the reason is for. */
  readonly label: string;
  /** The error's message, shown below the label and read as the field's description. */
  readonly description: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The current problem with the value, if any. */
  readonly error?: string;
}

/**
 * One reason field.
 * @param props - Identity, label, the error's message, hint, value and problem.
 * @returns The labelled textarea with its hint and problem.
 */
export function AcknowledgementField(props: AcknowledgementFieldProps) {
  const { id, label, description, hint, value, onChange, error } = props;
  const hintId = `${id}-hint`;
  const descriptionId = `${id}-message`;
  const describedBy = [descriptionId, hintId, ...(error ? [fieldErrorId(id)] : [])].join(' ');
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      <p id={descriptionId} className="m-0">
        {description}
      </p>
      <p id={hintId} className="m-0 text-hvl-ink-muted">
        {hint}
      </p>
      {error ? (
        <p id={fieldErrorId(id)} className="m-0 font-bold text-hvl-feedback-incorrect-fg">
          <span aria-hidden="true">{ERROR_ICON} </span>
          {error}
        </p>
      ) : null}
      <textarea
        id={id}
        value={value}
        rows={3}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 block w-full rounded border-2 bg-hvl-surface p-2 ${
          error ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-ink-muted'
        }`}
      />
    </div>
  );
}
