/**
 * NotFound — the page for a path neither Express nor a web page answers (HTTP 404).
 *
 * Why: unknown GET paths reach the web app last (D-068); the answer says nothing about why the path is unknown, as
 *      the server's own 404 page does.
 * Spec: AUTH-003
 * Collaborators: ../i18n/requestLocale.ts, ../i18n/translate.ts.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts
 */
import { requestLocale } from '../i18n/requestLocale';
import { t } from '../i18n/translate';

/**
 * The not-found page.
 * @returns The page content.
 */
export default async function NotFound() {
  const locale = await requestLocale();
  return (
    <main>
      <h1>{t('notFound.title', locale)}</h1>
      <p>{t('notFound.body', locale)}</p>
    </main>
  );
}
