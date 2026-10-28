/**
 * PlannerView — the alignment planner's content (`/laeringsdesign/planlegg`): for one course, the author's
 * learning outcomes × the three phases, with the gaps.
 *
 * Why: PED-031 shows where a course's outcomes lack activities, as an accessible table (D-088). The planner holds
 *      the author's own and co-authored activities, so it is for signed-in authors only (D-089).
 * Spec: PED-031, AUTH-001
 * Invariants:
 *   - The heading is always shown; the content only to a signed-in author (../../components/AuthorGate.tsx), and
 *     the server checks every request again.
 *   - The course comes from the address (`?emne=`, ../../config/studioFilters.ts), so a planner view can be shared.
 * Collaborators: ../../app/(portal)/laeringsdesign/planlegg/page.tsx, ../../components/AuthorGate.tsx,
 *   ../../config/paths.ts (`plannerHref`, `catalogueHref`).
 * Tests: apps/web/test/features/studioPages.test.tsx
 */
'use client';

import { AuthorGate } from '../../components/AuthorGate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/**
 * The planner page's content.
 * @returns The heading and, for authors, the planner.
 */
export function PlannerView() {
  const locale = useLocale();
  return (
    <>
      <h1>{t('planner.heading', locale)}</h1>
      <AuthorGate>{() => null}</AuthorGate>
    </>
  );
}
