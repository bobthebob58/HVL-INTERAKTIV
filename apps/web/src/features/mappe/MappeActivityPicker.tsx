/**
 * MappeActivityPicker — the `/mappe` picker: the matching activities as checkboxes in a fieldset, «select all» and
 * «remove all», and at most 50 chosen, with the reason in text.
 *
 * Why: MAPPE-001 lets an author choose which activities the portfolio documents; the contract allows 1 to 50
 *      (`MAPPE_MAX_ACTIVITIES`), so the page says so before the server would refuse.
 * Spec: MAPPE-001, UD-010, UD-013
 * Invariants:
 *   - A11Y: one fieldset with a legend; each checkbox has its own label with the title (marked with the activity's
 *     language, WCAG 3.1.2) and its type, status, course, phase and date. At the limit the unchosen boxes stay
 *     focusable but marked `aria-disabled`, described by the visible limit text, which is also a polite status.
 *   - «Select all» adds the matching activities up to the limit and never removes a choice; «remove all» clears every
 *     choice, also of activities the filters hide.
 * Collaborators: ./MappeWorkspace.tsx, ../../i18n/contentTypeName.ts, ../../i18n/formatDate.ts,
 *   ../../i18n/partLanguage.ts.
 * Tests: apps/web/test/features/MappeView.test.tsx
 */
'use client';

import type { MappeActivity, PhaseKey } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { contentTypeName } from '../../i18n/contentTypeName';
import { formatDate } from '../../i18n/formatDate';
import { partLanguage } from '../../i18n/partLanguage';
import { t } from '../../i18n/translate';

/** What the picker needs. */
export interface MappeActivityPickerProps {
  /** The activities that match the filters. */
  readonly items: readonly MappeActivity[];
  /** The chosen activity IDs, matching or not. */
  readonly chosen: ReadonlySet<string>;
  readonly onChange: (chosen: ReadonlySet<string>) => void;
  /** The most activities a portfolio may hold. */
  readonly max: number;
  readonly phaseLabel: (phase: PhaseKey) => string;
}

/**
 * The picker.
 * @param props - The matching activities, the choice and the limit.
 * @returns A fieldset of checkboxes with the two buttons and the count.
 */
export function MappeActivityPicker({ items, chosen, onChange, max, phaseLabel }: MappeActivityPickerProps) {
  const locale = useLocale();
  const id = useId();
  const atLimit = chosen.size >= max;
  const toggle = (contentId: string) => {
    const next = new Set(chosen);
    if (next.has(contentId)) next.delete(contentId);
    else if (!atLimit) next.add(contentId);
    onChange(next);
  };
  const chooseAll = () => {
    const next = new Set(chosen);
    for (const item of items) if (next.size < max) next.add(item.contentId);
    onChange(next);
  };
  const details = (item: MappeActivity) =>
    t('mappe.activityDetails', locale, {
      type: contentTypeName(item.mainLibrary, locale),
      status: t(`status.${item.status}`, locale),
      course: item.courseCode ?? t('mappe.courseNone', locale),
      phase: item.phase ? phaseLabel(item.phase) : t('mappe.phaseNone', locale),
      date: formatDate(item.updatedAt, locale),
    });
  return (
    <fieldset className="mb-4 border-0 p-0">
      <legend className="mb-1 text-lg font-bold">{t('mappe.pickerLegend', locale)}</legend>
      <div role="status">
        <p className="m-0">{t('mappe.pickerCount', locale, { count: chosen.size, max })}</p>
        {atLimit ? (
          <p id={`${id}-limit`} className="m-0 font-bold">
            {t('mappe.pickerLimit', locale, { max })}
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="button-secondary" onClick={chooseAll}>
          {t('mappe.selectAll', locale)}
        </button>
        <button type="button" className="button-secondary" onClick={() => onChange(new Set())}>
          {t('mappe.selectNone', locale)}
        </button>
      </div>
      {items.length === 0 ? (
        <p>{t('mappe.noMatches', locale)}</p>
      ) : (
        <ul className="m-0 mt-2 list-none p-0">
          {items.map((item) => {
            const checked = chosen.has(item.contentId);
            const blocked = atLimit && !checked;
            return (
              <li key={item.contentId} className="mt-1 flex items-start gap-2">
                <input
                  id={`${id}-${item.contentId}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.contentId)}
                  aria-disabled={blocked ? true : undefined}
                  aria-describedby={blocked ? `${id}-limit` : undefined}
                  className="mt-1 min-h-6 min-w-6"
                />
                <label htmlFor={`${id}-${item.contentId}`}>
                  <span lang={partLanguage(item.language, locale)} className="font-bold">
                    {item.title}
                  </span>{' '}
                  <span className="text-hvl-ink-muted">{details(item)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
