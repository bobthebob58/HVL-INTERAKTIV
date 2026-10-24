/**
 * RootLayout — the document every web page shares: `<html lang>` in the request's locale, the title template, the
 * skip link and the locale for client components.
 *
 * Why: screen readers need the page language (WCAG 3.1.1, UD-010), and the language is Express's decision
 *      (./../i18n/requestLocale.ts). Reading it makes every page dynamic, so each response carries its own nonce (D-070).
 *      The skip link is the first thing on every page (UD-006); each page's chrome provides its `main#main` target.
 * Spec: UD-010, PROD-012, UD-006, UD-013
 * Invariants:
 *   - `lang` is always one of `nn`, `nb`, `en`.
 *   - No inline script or style of our own; Next.js puts the request's nonce on its scripts.
 *   - The skip link is the first focusable element and targets `#main` (../components/PortalChrome.tsx `MAIN_ID`).
 *   - A page's title is "<page> – HVL Interaktiv" (WCAG 2.4.2, ../i18n/pageTitle.ts); a page without one of its own
 *     (the start page) is titled with the site name.
 * Collaborators: ../i18n/requestLocale.ts, ../i18n/translate.ts, ../i18n/LocaleContext.tsx, ./globals.css,
 *   ./(portal)/layout.tsx, ./app/play/page.tsx, ./not-found.tsx.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { MAIN_ID } from '../components/PortalChrome';
import { LocaleProvider } from '../i18n/LocaleContext';
import { pageTitle } from '../i18n/pageTitle';
import { requestLocale } from '../i18n/requestLocale';
import { t } from '../i18n/translate';
import './globals.css';

/**
 * The title template of every page, and the site name for a page without a title of its own.
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return { title: { default: t('site.name', locale), template: pageTitle('%s', locale) } };
}

/** A11Y: WCAG 1.4.4 and 1.4.10: the page may always be zoomed; nothing limits the scale. */
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/**
 * The root layout.
 * @param props - The page to wrap.
 * @returns The document.
 */
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const locale = await requestLocale();
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <a href={`#${MAIN_ID}`} className="skip-link">
          {t('site.skipToMain', locale)}
        </a>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
