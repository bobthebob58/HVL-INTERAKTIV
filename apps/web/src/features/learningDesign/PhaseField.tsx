/**
 * PhaseField — the **Læringsdesign** tab's choice of phase: radio buttons labelled from content, plus «Ingen fase».
 *
 * Why: PED-030 tags an activity with its phase; the labels are configuration, not code (PED-001), so they come from
 *      `GET /api/studio` in the page's language, in content order. Radio buttons in a fieldset with a legend show
 *      the three choices at once and are announced as one group (WCAG 1.3.1).
 * Spec: PED-030, PED-001, UD-013
 * Invariants:
 *   - Only the phase keys the overview lists are offered, with their labels; the stored key is kept while the
 *     overview cannot be loaded, and the field then says so.
 *   - «Ingen fase» clears the phase (the field is optional, D-087).
 * Collaborators: ./LearningDesignPanel.tsx, @hvl-interaktiv/api-contract (types only).
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import type { PhaseKey, StudioOverview } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** The `id` and React key part of «Ingen fase», which has no phase key. */
const NO_PHASE_SLUG = 'none';

/** What the field needs. */
export interface PhaseFieldProps {
  /** The overview with the phases, or its loading state. */
  readonly overview: StudioOverview | 'loading' | 'failed';
  /** The chosen phase key, or `''` for none. */
  readonly value: PhaseKey | '';
  readonly onChange: (value: PhaseKey | '') => void;
}

/**
 * The phase radios.
 * @param props - The overview, the chosen phase and the change handler.
 * @returns A fieldset with a legend, a hint and one radio per phase plus «Ingen fase».
 */
export function PhaseField({ overview, value, onChange }: PhaseFieldProps) {
  const locale = useLocale();
  const base = useId();
  const hintId = `${base}-hint`;
  const choices =
    typeof overview === 'object'
      ? [
          { key: '' as const, label: t('learningDesign.phaseNone', locale) },
          ...overview.phases.map((phase) => ({ key: phase.key, label: phase.label[locale] })),
        ]
      : [];
  return (
    <fieldset className="m-0 mb-4 border-0 p-0" aria-describedby={hintId}>
      <legend className="mb-1 text-lg font-bold">{t('learningDesign.phaseLegend', locale)}</legend>
      <p id={hintId} className="m-0 text-hvl-ink-muted">
        {t('learningDesign.phaseHint', locale)}
      </p>
      {overview === 'loading' ? <p role="status">{t('common.loading', locale)}</p> : null}
      {overview === 'failed' ? <p role="alert">{t('learningDesign.phasesFailed', locale)}</p> : null}
      {choices.map((choice) => {
        const slug = choice.key || NO_PHASE_SLUG;
        const id = `${base}-${slug}`;
        return (
          <div key={slug} className="mt-1 flex items-center gap-2">
            <input
              type="radio"
              id={id}
              name={`${base}-phase`}
              value={choice.key}
              checked={value === choice.key}
              onChange={() => onChange(choice.key)}
              className="min-h-target min-w-target"
            />
            <label htmlFor={id}>{choice.label}</label>
          </div>
        );
      })}
    </fieldset>
  );
}
