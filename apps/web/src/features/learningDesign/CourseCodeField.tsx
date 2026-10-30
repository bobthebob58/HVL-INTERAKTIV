/**
 * CourseCodeField — the **Læringsdesign** tab's course code: a text field that suggests the author's own course
 * codes and the course labels of their Canvas placements.
 *
 * Why: the planner and the portfolio match activities by course code (D-087, D-088), so the field offers the codes
 *      the author already uses rather than asking them to type the same code the same way each time. The server
 *      normalises the code (` syk 110 ` becomes `SYK110`), so any spacing or case is accepted.
 * Spec: PED-030, UD-013
 * Invariants:
 *   - Suggestions come from a `datalist`; typing any code stays possible (the field is optional).
 *   - The hint and the problem describe the field (`aria-describedby`); the problem has the ✗ icon and text.
 * Collaborators: ./LearningDesignPanel.tsx, ../../components/ErrorSummary.tsx.
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import { ERROR_ICON, fieldErrorId } from '../../components/ErrorSummary';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the field needs. */
export interface CourseCodeFieldProps {
  /** The field's `id`; the error summary links to it. */
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The author's course codes and Canvas labels. */
  readonly suggestions: readonly string[];
  readonly error?: string;
}

/**
 * The course-code field.
 * @param props - Identity, value, suggestions and problem.
 * @returns The labelled field with its hint, problem and suggestions.
 */
export function CourseCodeField({ id, value, onChange, suggestions, error }: CourseCodeFieldProps) {
  const locale = useLocale();
  const hintId = `${id}-hint`;
  const listId = `${id}-suggestions`;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-lg font-bold">
        {t('learningDesign.courseCodeLabel', locale)}
      </label>
      <p id={hintId} className="m-0 text-hvl-ink-muted">
        {t('learningDesign.courseCodeHint', locale)}
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
        value={value}
        list={suggestions.length > 0 ? listId : undefined}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, ...(error ? [fieldErrorId(id)] : [])].join(' ')}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 block w-full max-w-xs rounded border-2 bg-hvl-surface p-2 ${
          error ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-ink-muted'
        }`}
      />
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
