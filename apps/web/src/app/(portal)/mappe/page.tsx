/**
 * MappePage — `/mappe`: export a pedagogisk mappe draft from one's activities, for signed-in authors.
 *
 * Why: MAPPE-001 turns an author's activities and reasoning into a teaching-portfolio draft (D-094). It reads the
 *      author's own activities, so the view asks signed-out visitors to sign in and refuses non-authors (D-089).
 * Spec: MAPPE-001, UD-013
 * Invariants:
 *   - Titled "Pedagogisk mappe – HVL Interaktiv" (WCAG 2.4.2).
 * Collaborators: ../../../features/mappe/MappeView.tsx, ../../layout.tsx (title template).
 * Tests: apps/web/test/features/studioPages.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { MappeView } from '../../../features/mappe/MappeView';
import { requestLocale } from '../../../i18n/requestLocale';
import { t } from '../../../i18n/translate';

/**
 * The page title, "Pedagogisk mappe – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('mappe.pageTitle', await requestLocale()) };
}

/**
 * The portfolio page.
 * @returns The page content.
 */
export default function MappePage() {
  return <MappeView />;
}
