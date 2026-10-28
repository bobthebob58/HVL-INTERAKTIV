/**
 * PortalNotFound — the 404 page of a portal page that calls `notFound()`, inside the portal layout.
 *
 * Why: a pattern's page answers 404 for an ID that cannot be a pattern ID (./laeringsdesign/monster/[patternId]).
 *      Next.js renders this boundary inside ./layout.tsx, which already has the portal chrome, so it shows only the
 *      message; ../not-found.tsx, for paths no page has, brings the chrome itself. Both say the same (AUTH-003).
 * Spec: AUTH-003, UD-013
 * Invariants:
 *   - Exactly one `main#main` on the page (the layout's); titled "Fann ikkje sida – HVL Interaktiv" (WCAG 2.4.2).
 * Collaborators: ../../components/NotFoundContent.tsx, ./layout.tsx, ../not-found.tsx.
 * Tests: apps/server/test/web/webPages.browser.int.test.ts, apps/server/test/web/webChrome.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { NotFoundContent } from '../../components/NotFoundContent';
import { requestLocale } from '../../i18n/requestLocale';
import { t } from '../../i18n/translate';

/**
 * The page title, "Fann ikkje sida – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('notFound.title', await requestLocale()) };
}

/**
 * The not-found message inside the portal chrome.
 * @returns The page content.
 */
export default async function PortalNotFound() {
  return <NotFoundContent locale={await requestLocale()} />;
}
