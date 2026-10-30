/**
 * PlannerPage — `/laeringsdesign/planlegg`: the alignment planner for one course, for signed-in authors.
 *
 * Why: PED-031's grid of learning outcomes × phases shows the gaps in a course (D-088). It holds the author's own
 *      activities, so the view asks signed-out visitors to sign in and refuses non-authors (D-089).
 * Spec: PED-031, UD-013
 * Invariants:
 *   - Titled "Planleggar – HVL Interaktiv" (WCAG 2.4.2); the course is in the address (`?emne=`).
 * Collaborators: ../../../../features/planner/PlannerView.tsx, ../../../layout.tsx (title template).
 * Tests: apps/web/test/features/studioPages.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { PlannerView } from '../../../../features/planner/PlannerView';
import { requestLocale } from '../../../../i18n/requestLocale';
import { t } from '../../../../i18n/translate';

/**
 * The page title, "Planleggar – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('planner.pageTitle', await requestLocale()) };
}

/**
 * The planner page.
 * @returns The page content.
 */
export default function PlannerPage() {
  return <PlannerView />;
}
