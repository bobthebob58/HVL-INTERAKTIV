/**
 * ChoiceGroup — a group of radio buttons for one choice «Lag frå dette mønsteret» asks when the pattern offers two:
 * the content type or the phase; and the locale keys of the activity's languages.
 *
 * Why: a pattern with two content types (`ea-terms`) or two phases (`ea-diagnose`) lets the author choose (D-085).
 *      Two options read best as radio buttons in a labelled group (WCAG 1.3.1, 3.3.2).
 * Spec: PROD-001, UD-013
 * Invariants:
 *   - A `fieldset` with a `legend`; each option has its own label; one is always chosen.
 *   - The caller names the options: phase labels from the content (PED-001), content types from the locale files.
 * Collaborators: ./CreateFromPatternForm.tsx.
 * Tests: apps/web/test/features/PatternDetailView.test.tsx
 */
'use client';

import { useId } from 'react';
import type { Locale, MessageKey } from '../../../i18n/translate';

/** The locale key of each language an activity can be created in. */
export const LANGUAGE_KEYS: Readonly<Record<Locale, MessageKey>> = {
  nn: 'patterns.languageNn',
  nb: 'patterns.languageNb',
  en: 'patterns.languageEn',
};

/** What a choice group needs. */
export interface ChoiceGroupProps<T extends string> {
  /** The group's legend, e.g. «Fase». */
  readonly legend: string;
  readonly values: readonly T[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** The visible name of an option. */
  readonly label: (value: T) => string;
}

/**
 * The radio group.
 * @param props - The legend, the options, the chosen one, the change handler and the options' names.
 * @returns The fieldset.
 */
export function ChoiceGroup<T extends string>({
  legend,
  values,
  value,
  onChange,
  label,
}: ChoiceGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="m-0 mb-4 border-0 p-0">
      <legend className="font-bold">{legend}</legend>
      {values.map((option) => (
        <div key={option} className="flex min-h-6 items-center gap-2">
          <input
            type="radio"
            id={`${name}-${option}`}
            name={name}
            value={option}
            checked={option === value}
            onChange={() => onChange(option)}
          />
          <label htmlFor={`${name}-${option}`}>{label(option)}</label>
        </div>
      ))}
    </fieldset>
  );
}
