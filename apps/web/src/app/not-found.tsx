/**
 * NotFound — the page for a path neither Express nor a web page answers (HTTP 404), in the portal chrome.
 *
 * Why: unknown GET paths reach the web app last (D-068); the answer says nothing about why the path is unknown, as
 *      the server's own 404 page does. It keeps the header with Hjelp and the footer with Personvern (UD-013).
 * Spec: AUTH-003, UD-013
 * Collaborators: ../components/PortalChrome.tsx, ../i18n/requestLocale.ts, ../i18n/translate.ts.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts, apps/server/test/web/webPages.browser.int.test.ts
 */
import Link from 'next/link';
import { PortalChrome } from '../components/PortalChrome';
import { HOME_PATH } from '../config/paths';
import { requestLocale } from '../i18n/requestLocale';
import { t } from '../i18n/translate';

/**
 * The not-found page.
 * @returns The page content.
 */
export default async function NotFound() {
  const locale = await requestLocale();
  return (
    <PortalChrome locale={locale}>
      <h1>{t('notFound.title', locale)}</h1>
      <p>{t('notFound.body', locale)}</p>
      <p>
        <Link href={HOME_PATH} className="link-target">
          {t('site.home', locale)}
        </Link>
      </p>
    </PortalChrome>
  );
}
