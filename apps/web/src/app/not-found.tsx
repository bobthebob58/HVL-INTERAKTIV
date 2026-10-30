/**
 * NotFound — the page for a path neither Express nor a web page answers (HTTP 404), in the portal chrome.
 *
 * Why: unknown GET paths reach the web app last (D-068); the answer says nothing about why the path is unknown, as
 *      the server's own 404 page does. It keeps the header with Hjelp and the footer with Personvern (UD-013). A
 *      portal page that calls `notFound()` gets ./(portal)/not-found.tsx instead, inside the portal layout.
 * Spec: AUTH-003, UD-013
 * Collaborators: ../components/PortalChrome.tsx, ../components/NotFoundContent.tsx, ./(portal)/not-found.tsx,
 *   ../i18n/requestLocale.ts, ../i18n/translate.ts.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { NotFoundContent } from '../components/NotFoundContent';
import { PortalChrome } from '../components/PortalChrome';
import { requestLocale } from '../i18n/requestLocale';
import { t } from '../i18n/translate';

/**
 * The page title, "Fann ikkje sida – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('notFound.title', await requestLocale()) };
}

/**
 * The not-found page.
 * @returns The page content.
 */
export default async function NotFound() {
  const locale = await requestLocale();
  return (
    <PortalChrome locale={locale}>
      <NotFoundContent locale={locale} />
    </PortalChrome>
  );
}
