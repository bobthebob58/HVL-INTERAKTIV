/**
 * BankPage — `/laeringsdesign/innhaldsbank`: the HVL content bank, for signed-in authors.
 *
 * Why: PROD-007 lets authors duplicate and adapt activities colleagues have listed in the bank (D-091). It shows
 *      colleagues' names, so the view asks signed-out visitors to sign in and the server refuses everyone but HVL
 *      authors (D-089).
 * Spec: PROD-007, UD-013
 * Invariants:
 *   - Titled "Innhaldsbank – HVL Interaktiv" (WCAG 2.4.2).
 * Collaborators: ../../../../features/bank/BankView.tsx, ../../../layout.tsx (title template).
 * Tests: apps/web/test/features/studioPages.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { BankView } from '../../../../features/bank/BankView';
import { requestLocale } from '../../../../i18n/requestLocale';
import { t } from '../../../../i18n/translate';

/**
 * The page title, "Innhaldsbank – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('bank.pageTitle', await requestLocale()) };
}

/**
 * The content bank page.
 * @returns The page content.
 */
export default function BankPage() {
  return <BankView />;
}
