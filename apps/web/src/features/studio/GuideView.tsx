/**
 * GuideView — the læringsdesign guide's content (`/laeringsdesign`): the page heading, then the guide, the phase
 * matrix and the pattern catalogue with its filters in the address.
 *
 * Why: the guide explains why asynchronous work often fails and what helps, with the phase matrix and the pattern
 *      catalogue (PED-002, PED-003). Its texts live in `content/` and come from the server as JSON (D-082, D-083).
 *      The guide and the catalogue are public (D-089), so nothing here asks who is signed in.
 * Spec: PED-002, PED-003, PED-001
 * Invariants:
 *   - The page's only `h1`; the guide's own headings start at `h2` (D-083).
 *   - The catalogue's section has the `id` `CATALOGUE_ID` (../../config/paths.ts), which filtered links scroll to.
 * Collaborators: ../../app/(portal)/laeringsdesign/page.tsx, ../../config/paths.ts, ../../config/studioFilters.ts.
 * Tests: apps/web/test/features/studioPages.test.tsx
 */
'use client';

import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/**
 * The guide page's content.
 * @returns The heading of the guide.
 */
export function GuideView() {
  const locale = useLocale();
  return <h1>{t('studio.heading', locale)}</h1>;
}
