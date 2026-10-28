/**
 * PatternDetailView — one pattern's page (`/laeringsdesign/monster/[patternId]`): when to use it, why it works, an
 * example, and «Lag frå dette mønsteret».
 *
 * Why: authors choose a pattern before creating from it (PED-010, PROD-001). The page is public (D-089); creating
 *      from it asks a signed-out visitor to sign in, and opens the new activity on its **Rediger** tab (D-085,
 *      ../../config/paths.ts `activityPath(id, EDIT_TAB_ID)`).
 * Spec: PED-010, PROD-001, PED-002
 * Invariants:
 *   - The page's only `h1`; it names the pattern once the pattern has loaded.
 *   - The ID has the pattern-ID form (the page answers 404 otherwise); the API decides whether the pattern exists.
 *   - The address may carry the phase and course to pre-fill (`?fase=&emne=`, ../../config/studioFilters.ts).
 * Collaborators: ../../app/(portal)/laeringsdesign/monster/[patternId]/page.tsx, ../../config/paths.ts.
 * Tests: apps/web/test/features/studioPages.test.tsx
 */
'use client';

import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the pattern page needs. */
export interface PatternDetailViewProps {
  /** The pattern's ID from the address, already in the pattern-ID form. */
  readonly patternId: string;
}

/**
 * One pattern's page content.
 * @param props - The pattern's ID.
 * @returns The page heading.
 */
export function PatternDetailView({ patternId: _patternId }: PatternDetailViewProps) {
  const locale = useLocale();
  // WHY: the pattern's own name replaces this heading once its content is loaded (PED-010); until then the heading
  // says which kind of page this is, as the activity page's title does.
  return <h1>{t('patterns.heading', locale)}</h1>;
}
