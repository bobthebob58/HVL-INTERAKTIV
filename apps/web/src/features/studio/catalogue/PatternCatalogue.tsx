/**
 * PatternCatalogue — the pattern catalogue on the guide page: its filters, the number of patterns they show
 * (announced politely), the cards, a no-match state, and the way to a blank activity.
 *
 * Why: authors filter patterns by phase, content type and build time, and the filter state is in the address, so a
 *      filtered view can be shared (PED-003). A blank activity stays available beside the patterns (D-085).
 * Spec: PED-003, PED-002, UD-006
 * Invariants:
 *   - The section has the `id` `CATALOGUE_ID`, which filtered links (`catalogueHref`) scroll to, and its own `h2`.
 *   - The count is a status region that stays mounted, so each change is announced (WCAG 4.1.3); focus stays on the
 *     control that changed (WCAG 3.2.2).
 *   - With no match, «Vis alle mønstera» clears the filters (keeping the course) and moves focus to the phase
 *     control, since the button disappears (WCAG 2.4.3).
 *   - A link elsewhere on the page that filters the catalogue (the phase matrix's) moves focus to its heading
 *     (`focusCatalogueHeading`): a Next.js link scrolls to the catalogue but leaves focus behind (WCAG 2.4.3).
 * Collaborators: ../GuideView.tsx, ./CatalogueFilters.tsx, ./PatternCard.tsx, ./catalogueFilter.ts,
 *   ../../../config/paths.ts (`CATALOGUE_ID`, `NEW_ACTIVITY_PATH`).
 * Tests: apps/web/test/features/PatternCatalogue.test.tsx
 */
import type { StudioOverview } from '@hvl-interaktiv/api-contract';
import Link from 'next/link';
import { useRef, type MouseEvent } from 'react';
import { CATALOGUE_ID, NEW_ACTIVITY_PATH, type StudioFilters } from '../../../config/paths';
import { t, type Locale } from '../../../i18n/translate';
import { CatalogueFilters } from './CatalogueFilters';
import { matchingPatterns } from './catalogueFilter';
import { PatternCard } from './PatternCard';

/** The `id` of the catalogue's heading, which takes focus when a link on the page filters the catalogue. */
export const CATALOGUE_HEADING_ID = `${CATALOGUE_ID}-overskrift`;

/**
 * Moves focus to the catalogue's heading when a link on the guide page (the phase matrix's) filters it.
 * A11Y: WCAG 2.4.3: Next.js scrolls to `#monsterkatalog` but leaves focus on the link, out of view; a click that
 * opens a new tab or window is left alone.
 * @param event - The link's click.
 */
export function focusCatalogueHeading(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  document.getElementById(CATALOGUE_HEADING_ID)?.focus();
}

/** What the catalogue needs. */
export interface PatternCatalogueProps {
  readonly overview: StudioOverview;
  readonly filters: StudioFilters;
  readonly onFiltersChange: (next: StudioFilters) => void;
  readonly locale: Locale;
}

/**
 * The pattern catalogue.
 * @param props - The overview, the address's filters, the change handler and the locale.
 * @returns The catalogue's section.
 */
export function PatternCatalogue({ overview, filters, onFiltersChange, locale }: PatternCatalogueProps) {
  const phaseSelect = useRef<HTMLSelectElement>(null);
  const shown = matchingPatterns(overview.patterns, filters);
  const showAll = () => {
    onFiltersChange(filters.course ? { course: filters.course } : {});
    // A11Y: WCAG 2.4.3: the button disappears with the no-match state; focus goes to the first filter.
    phaseSelect.current?.focus();
  };
  return (
    <section id={CATALOGUE_ID} aria-labelledby={CATALOGUE_HEADING_ID} className="mt-8">
      <h2 id={CATALOGUE_HEADING_ID} tabIndex={-1}>
        {t('studio.catalogueHeading', locale)}
      </h2>
      <CatalogueFilters
        phases={overview.phases}
        patterns={overview.patterns}
        filters={filters}
        onChange={onFiltersChange}
        locale={locale}
        phaseSelect={phaseSelect}
      />
      <p role="status" className="font-bold">
        {t('studio.catalogueCount', locale, { shown: shown.length, total: overview.patterns.length })}
      </p>
      {shown.length === 0 ? (
        <div>
          <p>{t('studio.catalogueNoMatch', locale)}</p>
          <button type="button" className="button-secondary" onClick={showAll}>
            {t('studio.catalogueShowAll', locale)}
          </button>
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {shown.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              phases={overview.phases}
              filters={filters}
              locale={locale}
            />
          ))}
        </ul>
      )}
      <p className="mt-4">
        <Link href={NEW_ACTIVITY_PATH} className="link-target">
          {t('studio.blankActivity', locale)}
        </Link>
      </p>
    </section>
  );
}
