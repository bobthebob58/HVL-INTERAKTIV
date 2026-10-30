/**
 * catalogueFilter — which patterns the catalogue shows for its filters (phase, content type, longest build time), and
 * the choices each filter offers.
 *
 * Why: authors filter the catalogue by phase, content type and estimated build time (PED-003). The rules are pure,
 *      so the catalogue, its count and its filter controls agree, and a test can check them without a page.
 * Spec: PED-003
 * Invariants:
 *   - A pattern matches when it has the chosen phase, the chosen content type and a build time no longer than the
 *     chosen limit; an unset filter matches everything. The order is the overview's (by ID).
 *   - The content-type choices are the types the catalogue holds, in the ten types' order, plus a type the address
 *     names that no pattern has, so the control always shows the active filter.
 *   - The build-time choices are fixed limits, plus a limit from the address that is not one of them.
 * Collaborators: ./PatternCatalogue.tsx, ./CatalogueFilters.tsx, ../../../config/studioFilters.ts
 *   (`STUDIO_CONTENT_TYPES`), ../../../config/paths.ts (`StudioFilters`).
 * Tests: apps/web/test/features/catalogueFilter.test.ts
 */
import type { AuthorableContentType, PatternSummary } from '@hvl-interaktiv/api-contract';
import type { StudioFilters } from '../../../config/paths';
import { STUDIO_CONTENT_TYPES } from '../../../config/studioFilters';

/** The longest-build-time limits the filter offers, in minutes. */
export const BUILD_TIME_LIMITS: readonly number[] = [15, 30, 60, 120];

/**
 * The patterns that match the filters.
 * @param patterns - The catalogue.
 * @param filters - The active filters; the course is not a filter here.
 * @returns The matching patterns, in the catalogue's order.
 */
export function matchingPatterns(
  patterns: readonly PatternSummary[],
  { phase, type, buildTime }: StudioFilters,
): PatternSummary[] {
  return patterns.filter(
    (pattern) =>
      (!phase || pattern.phases.includes(phase)) &&
      (!type || pattern.contentTypes.includes(type)) &&
      (buildTime === undefined || pattern.buildMinutes <= buildTime),
  );
}

/**
 * The content types the type filter offers.
 * @param patterns - The catalogue.
 * @param filters - The active filters.
 * @returns The types, in the ten types' order.
 */
export function contentTypeChoices(
  patterns: readonly PatternSummary[],
  filters: StudioFilters,
): AuthorableContentType[] {
  const present = new Set<AuthorableContentType>(patterns.flatMap((pattern) => pattern.contentTypes));
  if (filters.type) present.add(filters.type);
  return STUDIO_CONTENT_TYPES.filter((type) => present.has(type));
}

/**
 * The limits the build-time filter offers.
 * @param filters - The active filters.
 * @returns The fixed limits and, when the address names another, that one too, in increasing order.
 */
export function buildTimeChoices(filters: StudioFilters): number[] {
  const limits = new Set(BUILD_TIME_LIMITS);
  if (filters.buildTime !== undefined) limits.add(filters.buildTime);
  return [...limits].sort((a, b) => a - b);
}
