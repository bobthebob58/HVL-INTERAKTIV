/**
 * PrivacyPage — `/personvern`, the short privacy notice the footer links to on every page, also from the Canvas
 * player: what is stored, why, for how long, and who sees what.
 *
 * Why: DATA-006 asks for this notice in nn, nb and en, and in particular that teachers see only groups of at least
 *      k = 5 learners (INS-006). Its text summarises spec 05 §2 and docs/privacy/DATA-INVENTORY.md in plain language.
 *      HVL's data protection officer must review the text before the pilot, together with the legal basis and the
 *      DPIA input (Q6, DATA-005); learning events and the Canvas gradebook arrive in S6 and are described as designed.
 * Spec: DATA-006, DATA-002, DATA-003, DATA-011
 * Invariants:
 *   - The text promises nothing the data inventory does not hold true; a change to the inventory is checked here.
 * Collaborators: ../../../components/TextSections.tsx, ../../../components/SiteFooter.tsx (`PRIVACY_PATH`).
 * Tests: apps/web/test/components/TextSections.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import { TextSections } from '../../../components/TextSections';
import { PRIVACY_SECTIONS } from '../../../features/info/privacySections';
import { requestLocale } from '../../../i18n/requestLocale';
import { t } from '../../../i18n/translate';

/**
 * The privacy notice.
 * @returns The page content.
 */
export default async function PrivacyPage() {
  const locale = await requestLocale();
  return (
    <>
      <h1>{t('privacy.title', locale)}</h1>
      <p className="font-body">{t('privacy.intro', locale)}</p>
      <TextSections sections={PRIVACY_SECTIONS} locale={locale} />
    </>
  );
}
