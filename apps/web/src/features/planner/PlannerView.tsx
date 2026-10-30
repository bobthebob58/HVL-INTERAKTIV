/**
 * PlannerView — the alignment planner's content (`/laeringsdesign/planlegg`): for one course, the author's
 * learning outcomes × the three phases, with the gaps.
 *
 * Why: PED-031 shows where a course's outcomes lack activities, as an accessible table (D-088). The planner holds
 *      the author's own and co-authored activities, so it is for signed-in authors only (D-089).
 * Spec: PED-031, AUTH-001
 * Invariants:
 *   - The heading and the introduction are always shown; the planner only to a signed-in author
 *     (../../components/AuthorGate.tsx), and the server checks every request again.
 *   - The course comes from the address (`?emne=`, ../../config/studioFilters.ts), so a planner view can be shared.
 * Collaborators: ../../app/(portal)/laeringsdesign/planlegg/page.tsx, ../../components/AuthorGate.tsx,
 *   ./PlannerWorkspace.tsx, ../../config/paths.ts (`plannerHref`, `catalogueHref`).
 * Tests: apps/web/test/features/studioPages.test.tsx, apps/web/test/features/PlannerView.test.tsx
 */
'use client';

import { AuthorGate } from '../../components/AuthorGate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { PlannerWorkspace } from './PlannerWorkspace';

/**
 * The planner page's content.
 * @param props - How to open another course's plan (the browser's own navigation by default).
 * @returns The heading and, for authors, the planner.
 */
export function PlannerView({
  navigate = (path: string) => window.location.assign(path),
}: {
  readonly navigate?: (path: string) => void;
}) {
  const locale = useLocale();
  return (
    <>
      <h1>{t('planner.heading', locale)}</h1>
      <p>{t('planner.intro', locale)}</p>
      <AuthorGate>{() => <PlannerWorkspace navigate={navigate} />}</AuthorGate>
    </>
  );
}
