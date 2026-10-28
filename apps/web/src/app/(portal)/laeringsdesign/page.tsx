/**
 * GuidePage — `/laeringsdesign`: the læringsdesign guide, the phase matrix and the pattern catalogue, for everyone.
 *
 * Why: the guide and the catalogue hold research summaries and patterns, nothing about people, so the owner made them
 *      public (D-089, 2026-10-28). The page is a shell; its content comes from the Express API in the browser, because
 *      the web app reads no files (D-068).
 * Spec: PED-002, PED-003, UD-013
 * Invariants:
 *   - Public: nothing on the page depends on a session.
 *   - Titled "Læringsdesign – HVL Interaktiv" (WCAG 2.4.2); the catalogue's filters live in the address (PED-003).
 * Collaborators: ../../../features/studio/GuideView.tsx, ../../layout.tsx (title template).
 * Tests: apps/web/test/features/studioPages.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { GuideView } from '../../../features/studio/GuideView';
import { requestLocale } from '../../../i18n/requestLocale';
import { t } from '../../../i18n/translate';

/**
 * The page title, "Læringsdesign – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('studio.pageTitle', await requestLocale()) };
}

/**
 * The guide page.
 * @returns The page content.
 */
export default function GuidePage() {
  return <GuideView />;
}
