/**
 * CountedField — a labelled text field (one line or several) with a hint, its problem and a character count against
 * a limit: the rationale and the learner purpose of the **Læringsdesign** tab.
 *
 * Why: D-087 limits the rationale to 1 000 characters and the purpose to 200 on one line. A count the author can
 *      read while typing prevents the error, and saying "too many" in words keeps it from depending on colour
 *      (UD-003, WCAG 1.4.1).
 * Spec: PED-030, UD-013, UD-003
 * Invariants:
 *   - The count is of the trimmed text, as the server counts it; over the limit it says how many too many, with the
 *     ✗ icon (hidden from screen readers), never by colour alone.
 *   - The hint, the problem and the count describe the field (`aria-describedby`); the count is not a live region,
 *     so a screen reader is not interrupted at every key.
 * Collaborators: ./LearningDesignPanel.tsx, ../../components/ErrorSummary.tsx (`fieldErrorId`, `ERROR_ICON`).
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import { ERROR_ICON, fieldErrorId } from '../../components/ErrorSummary';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the field needs. */
export interface CountedFieldProps {
  /** The field's `id`; the error summary links to it. */
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The most characters allowed, after trimming. */
  readonly max: number;
  /** A text area for several lines; one line by default. */
  readonly multiline?: boolean;
  /** The current problem with the value, if any. */
  readonly error?: string;
  /** The language of the text the author writes, when it differs from the page's (WCAG 3.1.2). */
  readonly lang?: string;
}

/**
 * One counted field.
 * @param props - Identity, texts, value, limit and problem.
 * @returns The labelled field with its hint, problem and count.
 */
export function CountedField(props: CountedFieldProps) {
  const { id, label, hint, value, onChange, max, multiline = false, error, lang } = props;
  const locale = useLocale();
  const count = value.trim().length;
  const over = count - max;
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const describedBy = [hintId, ...(error ? [fieldErrorId(id)] : []), countId].join(' ');
  const shared = {
    id,
    value,
    lang,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: `mt-1 block w-full rounded border-2 bg-hvl-surface p-2 ${
      error ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-ink-muted'
    }`,
  };
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
      {multiline ? (
        <textarea {...shared} rows={5} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...shared} type="text" onChange={(event) => onChange(event.target.value)} />
      )}
      <p id={countId} className={`m-0 ${over > 0 ? 'font-bold text-hvl-feedback-incorrect-fg' : ''}`}>
        {over > 0 ? (
          <>
            <span aria-hidden="true">{ERROR_ICON} </span>
            {t('learningDesign.countOver', locale, { count, max, over })}
          </>
        ) : (
          t('learningDesign.count', locale, { count, max })
        )}
      </p>
    </div>
  );
}
