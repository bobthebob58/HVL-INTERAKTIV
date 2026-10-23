/**
 * HelpPage — `/hjelp`, the help page the header links to on every page.
 *
 * Why: WCAG 3.2.6 (UD-013) wants help in the same place on every page. S4 starts the page here; its guide text
 *      comes from `content/` later in the session.
 * Spec: UD-013
 * Collaborators: ../../i18n/requestLocale.ts, ../../i18n/translate.ts.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts
 */
import { requestLocale } from '../../i18n/requestLocale';
import { t } from '../../i18n/translate';

/**
 * The help page.
 * @returns The page content.
 */
export default async function HelpPage() {
  const locale = await requestLocale();
  return (
    <main>
      <h1>{t('help.title', locale)}</h1>
      <p>{t('help.intro', locale)}</p>
    </main>
  );
}
