/**
 * useCatalogueFilters — the catalogue's filters as they stand in the page address (`?fase=&type=&tid=&emne=`), and
 * the function that changes them by replacing the address.
 *
 * Why: PED-003 keeps the filter state in the URL, so a filtered view can be shared and a planner cell can open the
 *      catalogue for its phase and course (D-088). The address is the only state: a shared or followed address
 *      restores the filters, and changing a filter writes it back with `router.replace` (no history entry per click).
 * Spec: PED-003
 * Invariants:
 *   - Reading goes through `readStudioFilters`, which drops values it does not know; writing through `catalogueHref`.
 *   - Until the router has applied a replaced address, the filters just written are shown, so a control never jumps
 *     back to its old value. Once the address has changed, that override is dropped, so any later address (a matrix
 *     link, back and forward) wins, even one equal to the address the filters were written from.
 *   - `scroll: false`: changing a filter never scrolls the page or moves focus away from the control (WCAG 3.2.2).
 * Collaborators: ../../../config/studioFilters.ts, ../../../config/paths.ts, ../GuideView.tsx, next/navigation.
 * Tests: apps/web/test/features/PatternCatalogue.test.tsx
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { catalogueHref, type StudioFilters } from '../../../config/paths';
import { readStudioFilters } from '../../../config/studioFilters';

/**
 * The catalogue's filters and the way to change them.
 * @returns The current filters, and `update(next)`, which writes them into the address.
 */
export function useCatalogueFilters(): readonly [StudioFilters, (next: StudioFilters) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const [written, setWritten] = useState<{ readonly from: string; readonly filters: StudioFilters }>();
  // WHY: an override kept past the router's change would win again whenever the address came back to `from`.
  if (written && written.from !== query) setWritten(undefined);
  const filters = written && written.from === query ? written.filters : readStudioFilters(params);
  const update = (next: StudioFilters) => {
    setWritten({ from: query, filters: next });
    router.replace(catalogueHref(next), { scroll: false });
  };
  return [filters, update] as const;
}
