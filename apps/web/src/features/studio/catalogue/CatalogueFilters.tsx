/**
 * CatalogueFilters — the catalogue's three filters: phase, content type and longest build time, each a labelled
 * `<select>` that applies when it changes.
 *
 * Why: authors narrow the catalogue to the patterns that fit their phase, content type and time (PED-003). Native
 *      selects are operable by keyboard and screen readers as they are, and changing one only filters the list on
 *      the same page, which is no change of context (WCAG 3.2.2).
 * Spec: PED-003, UD-006
 * Invariants:
 *   - Every control has a visible label; the group has a legend.
 *   - The value shown is the address's filter (./useCatalogueFilters.ts); "all" is the empty value and clears it.
 *   - Phase labels come from the content (PED-001); content-type names from the locale files.
 *   - The course in the address is kept when a filter changes.
 * Collaborators: ./PatternCatalogue.tsx, ./catalogueFilter.ts, ../../../i18n/contentTypeName.ts.
 * Tests: apps/web/test/features/PatternCatalogue.test.tsx
 */
import type { Phase, PatternSummary } from '@hvl-interaktiv/api-contract';
import { useId, type RefObject } from 'react';
import type { StudioFilters } from '../../../config/paths';
import { STUDIO_CONTENT_TYPES, STUDIO_PHASE_KEYS } from '../../../config/studioFilters';
import { contentTypeName } from '../../../i18n/contentTypeName';
import { t, type Locale } from '../../../i18n/translate';
import { buildTimeChoices, contentTypeChoices } from './catalogueFilter';

/** What the filters need. */
export interface CatalogueFiltersProps {
  readonly phases: readonly Phase[];
  readonly patterns: readonly PatternSummary[];
  readonly filters: StudioFilters;
  readonly onChange: (next: StudioFilters) => void;
  readonly locale: Locale;
  /** The phase control, which takes focus when «Vis alle mønstera» clears the filters. */
  readonly phaseSelect?: RefObject<HTMLSelectElement | null>;
}

const SELECT = 'block min-h-6 rounded border border-hvl-ink-muted bg-hvl-surface px-2 py-1 text-hvl-ink';

/**
 * The catalogue's filter controls.
 * @param props - The phases, the catalogue, the active filters, the change handler and the locale.
 * @returns The labelled group of selects.
 */
export function CatalogueFilters({
  phases,
  patterns,
  filters,
  onChange,
  locale,
  phaseSelect,
}: CatalogueFiltersProps) {
  const id = useId();
  const set = (change: Partial<StudioFilters>) => onChange({ ...filters, ...change });
  return (
    <fieldset className="m-0 mb-4 flex flex-wrap gap-4 border-0 p-0">
      <legend className="mb-2 font-bold">{t('studio.filterLegend', locale)}</legend>
      <div>
        <label htmlFor={`${id}-phase`}>{t('studio.filterPhase', locale)}</label>
        <select
          id={`${id}-phase`}
          ref={phaseSelect}
          className={SELECT}
          value={filters.phase ?? ''}
          onChange={(event) => set({ phase: STUDIO_PHASE_KEYS.find((key) => key === event.target.value) })}
        >
          <option value="">{t('studio.filterAnyPhase', locale)}</option>
          {phases.map((phase) => (
            <option key={phase.key} value={phase.key}>
              {phase.label[locale]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-type`}>{t('studio.filterType', locale)}</label>
        <select
          id={`${id}-type`}
          className={SELECT}
          value={filters.type ?? ''}
          onChange={(event) =>
            set({ type: STUDIO_CONTENT_TYPES.find((type) => type === event.target.value) })
          }
        >
          <option value="">{t('studio.filterAnyType', locale)}</option>
          {contentTypeChoices(patterns, filters).map((type) => (
            <option key={type} value={type}>
              {contentTypeName(type, locale)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-time`}>{t('studio.filterBuildTime', locale)}</label>
        <select
          id={`${id}-time`}
          className={SELECT}
          value={filters.buildTime === undefined ? '' : String(filters.buildTime)}
          onChange={(event) =>
            set({ buildTime: event.target.value === '' ? undefined : Number(event.target.value) })
          }
        >
          <option value="">{t('studio.filterAnyTime', locale)}</option>
          {buildTimeChoices(filters).map((minutes) => (
            <option key={minutes} value={String(minutes)}>
              {t('studio.filterMinutes', locale, { minutes })}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
