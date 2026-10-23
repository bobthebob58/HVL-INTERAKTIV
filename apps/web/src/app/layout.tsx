/**
 * RootLayout — the document every web page shares: `<html lang>` in the request's locale and the site title.
 *
 * Why: screen readers need the page language (WCAG 3.1.1, UD-010), and the language is Express's decision
 *      (./../i18n/requestLocale.ts). Reading it makes every page dynamic, so each response carries its own nonce (D-070).
 * Spec: UD-010, PROD-012
 * Invariants:
 *   - `lang` is always one of `nn`, `nb`, `en`.
 *   - No inline script or style of our own; Next.js puts the request's nonce on its scripts.
 * Collaborators: ../i18n/requestLocale.ts, ../i18n/translate.ts, ./globals.css.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requestLocale } from '../i18n/requestLocale';
import { t } from '../i18n/translate';
import './globals.css';

/**
 * The default title of every page.
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('site.name', await requestLocale()) };
}

/**
 * The root layout.
 * @param props - The page to wrap.
 * @returns The document.
 */
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const locale = await requestLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
