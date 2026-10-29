/**
 * MappeOptions — the `/mappe` page's choice of criteria set and of the portfolio's language.
 *
 * Why: MAPPE-002 keys the criteria by set (default `hvl-merittering-2025`), and switching the set changes every
 *      criterion text, the reader's guide and the limits; the template exists in Nynorsk, Bokmål and English, so a
 *      teacher can write the portfolio in another language than the page's.
 * Spec: MAPPE-002, PROD-012
 * Invariants:
 *   - A11Y: both selects have visible labels in one fieldset with a legend; a set whose limits ALU has not confirmed
 *     says so in its option text.
 *   - The set titles come from the content files (the server), never from code.
 *   - A11Y: WCAG 1.4.10: a long set title never widens the page at 320 px; the select shrinks to the page's width
 *     (its full text is in the open list and its accessible value), since a fieldset is as wide as its widest
 *     content unless told otherwise.
 * Collaborators: ./MappeWorkspace.tsx.
 * Tests: apps/web/test/features/MappeView.test.tsx
 */
'use client';

import type { MappeCriteriaSet } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { LOCALES, t, type Locale, type MessageKey } from '../../i18n/translate';

/** What the options need. */
export interface MappeOptionsProps {
  readonly sets: readonly MappeCriteriaSet[];
  readonly criteriaSet: string;
  readonly onCriteriaSet: (id: string) => void;
  readonly language: Locale;
  readonly onLanguage: (language: Locale) => void;
}

const LANGUAGE_NAME: Readonly<Record<Locale, MessageKey>> = {
  nn: 'mappe.languageNn',
  nb: 'mappe.languageNb',
  en: 'mappe.languageEn',
};

const CONTROL = 'min-h-target max-w-full rounded border-2 border-hvl-ink-muted bg-hvl-surface p-1';

/**
 * The criteria set and language selects.
 * @param props - The sets, the choices and their setters.
 * @returns A fieldset with two selects.
 */
export function MappeOptions({ sets, criteriaSet, onCriteriaSet, language, onLanguage }: MappeOptionsProps) {
  const locale = useLocale();
  const id = useId();
  return (
    <fieldset className="mb-4 min-w-0 border-0 p-0">
      <legend className="mb-1 text-lg font-bold">{t('mappe.optionsLegend', locale)}</legend>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 max-w-full">
          <label htmlFor={`${id}-set`} className="block font-bold">
            {t('mappe.criteriaSetLabel', locale)}
          </label>
          <select
            id={`${id}-set`}
            value={criteriaSet}
            onChange={(event) => onCriteriaSet(event.target.value)}
            className={CONTROL}
          >
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.limitsToVerify
                  ? t('mappe.criteriaSetToVerify', locale, { title: set.title[locale] })
                  : set.title[locale]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-language`} className="block font-bold">
            {t('mappe.languageLabel', locale)}
          </label>
          <select
            id={`${id}-language`}
            value={language}
            onChange={(event) => onLanguage(event.target.value as Locale)}
            className={CONTROL}
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {t(LANGUAGE_NAME[code], locale)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}
