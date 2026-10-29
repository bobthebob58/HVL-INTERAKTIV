/**
 * OutcomeFields — the **Læringsdesign** tab's learning outcomes: a numbered list where each outcome has its text, its
 * NKR category and a remove button, and a button that adds one.
 *
 * Why: PED-030 tags an activity with the outcomes it serves, each with its category in the Norwegian qualifications
 *      framework (NKR); D-087 allows up to 20. Adding and removing must keep keyboard and screen-reader users in
 *      place (UD-006, WCAG 2.4.3): focus moves to what replaced the control that went away, and each change is
 *      announced (WCAG 4.1.3).
 * Spec: PED-030, UD-006, UD-013
 * Invariants:
 *   - After adding, focus is on the new outcome's text. After removing, it is on the text of the outcome that took
 *     its place, else the one before it, else the add button.
 *   - Labels are numbered from the list's order ("Læringsutbytte 2"), and every control names its outcome's number,
 *     so three remove buttons are told apart (WCAG 2.4.6).
 *   - At 20 outcomes the add button gives way to a sentence saying so; nothing is lost.
 * Collaborators: ./LearningDesignPanel.tsx, ./learningDesignForm.ts, ../../components/ErrorSummary.tsx.
 * Tests: apps/web/test/features/OutcomeFields.test.tsx
 */
'use client';

import type { OutcomeCategory } from '@hvl-interaktiv/api-contract';
import { useEffect, useState } from 'react';
import { ERROR_ICON, fieldErrorId } from '../../components/ErrorSummary';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type MessageKey } from '../../i18n/translate';
import { MAX_OUTCOMES, OUTCOME_CATEGORIES, type OutcomeDraft } from './learningDesignForm';

/** The label of each NKR category. */
export const CATEGORY_LABEL: Readonly<Record<OutcomeCategory, MessageKey>> = {
  kunnskap: 'learningDesign.categoryKunnskap',
  ferdigheiter: 'learningDesign.categoryFerdigheiter',
  'generell-kompetanse': 'learningDesign.categoryGenerellKompetanse',
};

/** What the list needs. */
export interface OutcomeFieldsProps {
  readonly outcomes: readonly OutcomeDraft[];
  readonly onChange: (outcomes: readonly OutcomeDraft[]) => void;
  /** Makes a fresh outcome key. */
  readonly newKey: () => string;
  /** The `id` of an outcome's text field (the error summary links to it). */
  readonly fieldId: (key: string) => string;
  /** The problem with each outcome, by key. */
  readonly errors: ReadonlyMap<string, string>;
  /** Says a change in the page's status region. */
  readonly announce: (message: string) => void;
}

/**
 * The outcome list.
 * @param props - The outcomes, the change handler, keys, field `id`s, problems and the announcer.
 * @returns A fieldset with the numbered outcomes and the add button.
 */
export function OutcomeFields({ outcomes, onChange, newKey, fieldId, errors, announce }: OutcomeFieldsProps) {
  const locale = useLocale();
  const addId = `${fieldId('add')}-button`;
  // WHY: a request is a new object each time, so the effect runs once per add or remove, also for the same `id`.
  const [focusRequest, setFocusRequest] = useState<{ readonly id: string }>();
  useEffect(() => {
    // A11Y: WCAG 2.4.3: after the render that added or removed an outcome, focus goes to what took its place.
    if (focusRequest) document.getElementById(focusRequest.id)?.focus();
  }, [focusRequest]);

  const update = (key: string, change: Partial<OutcomeDraft>) =>
    onChange(outcomes.map((outcome) => (outcome.key === key ? { ...outcome, ...change } : outcome)));
  const add = () => {
    const key = newKey();
    onChange([...outcomes, { key, text: '', category: 'kunnskap' }]);
    setFocusRequest({ id: fieldId(key) });
    announce(t('learningDesign.outcomeAdded', locale, { number: outcomes.length + 1 }));
  };
  const remove = (index: number) => {
    const next = outcomes.filter((_, at) => at !== index);
    onChange(next);
    const neighbour = next[index] ?? next[index - 1];
    setFocusRequest({ id: neighbour ? fieldId(neighbour.key) : addId });
    announce(t('learningDesign.outcomeRemoved', locale, { number: index + 1 }));
  };

  return (
    <fieldset className="m-0 mb-4 border-0 p-0" aria-describedby={`${addId}-hint`}>
      <legend className="mb-1 text-lg font-bold">{t('learningDesign.outcomesLegend', locale)}</legend>
      <p id={`${addId}-hint`} className="m-0 text-hvl-ink-muted">
        {t('learningDesign.outcomesHint', locale, { max: MAX_OUTCOMES })}
      </p>
      {outcomes.length === 0 ? <p>{t('learningDesign.outcomesNone', locale)}</p> : null}
      <ol className="m-0 p-0 pl-6">
        {outcomes.map((outcome, index) => {
          const number = index + 1;
          const id = fieldId(outcome.key);
          const error = errors.get(outcome.key);
          return (
            <li key={outcome.key} className="mt-3">
              <label htmlFor={id} className="block font-bold">
                {t('learningDesign.outcomeLabel', locale, { number })}
              </label>
              {error ? (
                <p id={fieldErrorId(id)} className="m-0 font-bold text-hvl-feedback-incorrect-fg">
                  <span aria-hidden="true">{ERROR_ICON} </span>
                  {error}
                </p>
              ) : null}
              <textarea
                id={id}
                rows={2}
                value={outcome.text}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? fieldErrorId(id) : undefined}
                onChange={(event) => update(outcome.key, { text: event.target.value })}
                className={`mt-1 block w-full rounded border-2 bg-hvl-surface p-2 ${
                  error ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-ink-muted'
                }`}
              />
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor={`${id}-category`} className="block">
                    {t('learningDesign.outcomeCategoryLabel', locale, { number })}
                  </label>
                  <select
                    id={`${id}-category`}
                    value={outcome.category}
                    onChange={(event) =>
                      update(outcome.key, { category: event.target.value as OutcomeCategory })
                    }
                    className="min-h-target rounded border-2 border-hvl-ink-muted bg-hvl-surface p-1"
                  >
                    {OUTCOME_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {t(CATEGORY_LABEL[category], locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="button-secondary" onClick={() => remove(index)}>
                  {t('learningDesign.outcomeRemove', locale, { number })}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {outcomes.length < MAX_OUTCOMES ? (
        <button id={addId} type="button" className="button-secondary mt-3" onClick={add}>
          {t('learningDesign.outcomeAdd', locale)}
        </button>
      ) : (
        <p id={addId} tabIndex={-1} className="mt-3">
          {t('learningDesign.outcomesFull', locale, { max: MAX_OUTCOMES })}
        </p>
      )}
    </fieldset>
  );
}
