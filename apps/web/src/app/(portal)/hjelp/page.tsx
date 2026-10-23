/**
 * HelpPage — `/hjelp`, the help page the header links to on every page: how to create, check and publish an
 * activity, how to use it in Canvas, and where to get more help.
 *
 * Why: WCAG 3.2.6 (UD-013) wants help in the same place on every page; the header's Hjelp link leads here, also from
 *      Canvas (in a new tab). The steps follow the product's own flow (PROD-003, PROD-011).
 * Spec: UD-013, PROD-003, PROD-011
 * Collaborators: ../../../components/TextSections.tsx, ../../../i18n/requestLocale.ts, ../../../i18n/translate.ts.
 * Tests: apps/web/test/components/TextSections.test.tsx, apps/server/test/web/webApp.browser.int.test.ts
 */
import { TextSections } from '../../../components/TextSections';
import { HELP_SECTIONS } from '../../../features/info/helpSections';
import { requestLocale } from '../../../i18n/requestLocale';
import { t } from '../../../i18n/translate';

/**
 * The help page.
 * @returns The page content.
 */
export default async function HelpPage() {
  const locale = await requestLocale();
  return (
    <>
      <h1>{t('help.title', locale)}</h1>
      <p className="font-body">{t('help.intro', locale)}</p>
      <TextSections sections={HELP_SECTIONS} locale={locale} />
    </>
  );
}
