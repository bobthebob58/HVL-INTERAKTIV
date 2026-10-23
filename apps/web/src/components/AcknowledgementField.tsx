/**
 * AcknowledgementField — the reason an author gives for publishing despite one error, with its hint and problem.
 *
 * Why: PROD-003 and UD-022 let an author publish despite an error with a recorded reason of 1 to 500 characters. The
 *      field names the error in its label, explains the limit in a hint, and names its problem through
 *      `aria-describedby` so a screen reader reads it with the field (UD-013, WCAG 3.3.1 and 3.3.3).
 * Spec: UD-022, UD-013
 * Invariants:
 *   - `aria-describedby` lists the hint and, when there is one, the problem (`fieldErrorId`); `aria-invalid` then.
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
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The current problem with the value, if any. */
  readonly error?: string;
}

/**
 * One reason field.
 * @param props - Identity, texts, value and problem.
 * @returns The labelled textarea with its hint and problem.
 */
export function AcknowledgementField({ id, label, hint, value, onChange, error }: AcknowledgementFieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
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
        aria-describedby={error ? `${hintId} ${fieldErrorId(id)}` : hintId}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 block w-full rounded border-2 bg-hvl-surface p-2 ${
          error ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-ink-muted'
        }`}
      />
    </div>
  );
}
