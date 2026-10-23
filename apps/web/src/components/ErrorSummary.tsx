/**
 * ErrorSummary — the list of a form's problems at its top, each linked to the field it is about.
 *
 * Why: WCAG 3.3.1 and 3.3.3 (UD-013) ask errors to be identified in text and to say how to fix them. The summary
 *      takes focus when it appears, so keyboard and screen-reader users hear the problems at once; each link moves
 *      focus to its field, and each field names its message with `aria-describedby` (`fieldErrorId`).
 * Spec: UD-013, UD-006
 * Invariants:
 *   - Rendered only when there is at least one problem; mount it again (a new `key`) after each failed submit so it
 *     takes focus again.
 *   - A link moves focus to its field; it never navigates away.
 *   - Problems are shown with an icon and text, never by colour alone (UD-003).
 * Collaborators: ./PublishDialog.tsx, ../i18n/LocaleContext.tsx.
 * Tests: apps/web/test/components/ErrorSummary.test.tsx
 */
'use client';

import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n/translate';

/** One problem: the field it belongs to and what to do about it. */
export interface FieldError {
  /** The `id` of the field's input element. */
  readonly fieldId: string;
  readonly message: string;
}

/** The marker shown before each problem (✗); the text carries the meaning. */
export const ERROR_ICON = '✗';

/**
 * The `id` of a field's own error message, for its `aria-describedby`.
 * @param fieldId - The field's input `id`.
 * @returns The message element's `id`.
 */
export const fieldErrorId = (fieldId: string): string => `${fieldId}-error`;

/**
 * The summary of a form's problems.
 * @param props - The problems, at least one.
 * @returns The summary, which takes focus when it mounts.
 */
export function ErrorSummary({ errors }: { readonly errors: readonly FieldError[] }) {
  const locale = useLocale();
  const headingId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A11Y: WCAG 3.3.1: move focus to the summary so the problems are announced before anything else.
    box.current?.focus();
  }, []);
  const focusField = (event: MouseEvent<HTMLAnchorElement>, fieldId: string) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    event.preventDefault();
    field.focus();
    field.scrollIntoView?.({ block: 'center' });
  };
  const title =
    errors.length === 1
      ? t('errorSummary.titleOne', locale)
      : t('errorSummary.titleOther', locale, { count: errors.length });
  return (
    <div
      ref={box}
      tabIndex={-1}
      role="alert"
      aria-labelledby={headingId}
      className="mb-4 border-l-4 border-hvl-feedback-incorrect-border bg-hvl-feedback-incorrect-bg p-4 text-hvl-feedback-incorrect-fg"
    >
      <h2 id={headingId} className="text-hvl-feedback-incorrect-fg">
        {title}
      </h2>
      <ul className="m-0 list-none p-0">
        {errors.map((error) => (
          <li key={error.fieldId} className="mt-2">
            <span aria-hidden="true">{ERROR_ICON} </span>
            <a
              href={`#${error.fieldId}`}
              className="text-hvl-feedback-incorrect-fg"
              onClick={(event) => focusField(event, error.fieldId)}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
