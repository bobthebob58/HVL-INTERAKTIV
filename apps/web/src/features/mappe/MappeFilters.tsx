/**
 * MappeFilters — the `/mappe` picker's filters: course, phase and a range of change dates, with the number of
 * activities that match, announced politely.
 *
 * Why: MAPPE-001 selects activities "filtered by course, phase or date". The phase labels come from content through
 *      `GET /api/studio` (PED-001), never from code.
 * Spec: MAPPE-001, PED-001, UD-013
 * Invariants:
 *   - A11Y: every control has a visible label inside one fieldset with a legend (WCAG 1.3.1, 3.3.2); changing a
 *     filter moves no focus and only updates the list (WCAG 3.2.2), and the count is a polite status (WCAG 4.1.3).
 *   - UI strings come from the `mappe` locale namespace only.
 * Collaborators: ./MappeWorkspace.tsx, ./mappeFilter.ts.
 * Tests: apps/web/test/features/MappeView.test.tsx
 */
'use client';

import type { PhaseKey } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { NONE, type MappeFilters as Filters } from './mappeFilter';

/** What the filters need. */
export interface MappeFiltersProps {
  readonly filters: Filters;
  readonly onChange: (filters: Filters) => void;
  /** The course codes the author's activities use. */
  readonly courseCodes: readonly string[];
  /** The phases in content order, with their labels in the page's language. */
  readonly phases: readonly { readonly key: PhaseKey; readonly label: string }[];
  readonly shown: number;
  readonly total: number;
}

const CONTROL = 'min-h-target rounded border-2 border-hvl-ink-muted bg-hvl-surface p-1';

/**
 * The filters.
 * @param props - The current filters, their choices and the counts.
 * @returns A fieldset with four controls and the count.
 */
export function MappeFilters({ filters, onChange, courseCodes, phases, shown, total }: MappeFiltersProps) {
  const locale = useLocale();
  const id = useId();
  const set = (key: keyof Filters) => (event: { target: { value: string } }) =>
    onChange({ ...filters, [key]: event.target.value });
  return (
    <fieldset className="mb-4 border-0 p-0">
      <legend className="mb-1 text-lg font-bold">{t('mappe.filtersLegend', locale)}</legend>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={`${id}-course`} className="block font-bold">
            {t('mappe.courseLabel', locale)}
          </label>
          <select id={`${id}-course`} value={filters.course} onChange={set('course')} className={CONTROL}>
            <option value="">{t('mappe.courseAll', locale)}</option>
            {courseCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
            <option value={NONE}>{t('mappe.courseNone', locale)}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-phase`} className="block font-bold">
            {t('mappe.phaseLabel', locale)}
          </label>
          <select id={`${id}-phase`} value={filters.phase} onChange={set('phase')} className={CONTROL}>
            <option value="">{t('mappe.phaseAll', locale)}</option>
            {phases.map((phase) => (
              <option key={phase.key} value={phase.key}>
                {phase.label}
              </option>
            ))}
            <option value={NONE}>{t('mappe.phaseNone', locale)}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-from`} className="block font-bold">
            {t('mappe.fromLabel', locale)}
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={filters.from}
            onChange={set('from')}
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="block font-bold">
            {t('mappe.toLabel', locale)}
          </label>
          <input id={`${id}-to`} type="date" value={filters.to} onChange={set('to')} className={CONTROL} />
        </div>
      </div>
      <p role="status" className="mt-2">
        {t('mappe.filterCount', locale, { shown, total })}
      </p>
    </fieldset>
  );
}
