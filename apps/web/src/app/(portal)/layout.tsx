/**
 * PortalLayout — wraps every portal page (start page, activity pages, help, privacy) in the portal chrome.
 *
 * Why: the route group `(portal)` gives these pages the same header with **Hjelp** (UD-013), the `main#main` skip link
 *      target (UD-006) and the footer with **Personvern** (DATA-006), without changing their addresses. The Canvas
 *      page (`/app/play`) has its own chrome, whose links open in a new tab.
 * Spec: UD-006, UD-013, DATA-006
 * Collaborators: ../../components/PortalChrome.tsx, ../../i18n/requestLocale.ts.
 * Tests: apps/server/test/web/webPages.browser.int.test.ts
 */
import type { ReactNode } from 'react';
import { PortalChrome } from '../../components/PortalChrome';
import { requestLocale } from '../../i18n/requestLocale';

/**
 * The portal layout.
 * @param props - The page.
 * @returns The page inside the portal chrome.
 */
export default async function PortalLayout({ children }: { readonly children: ReactNode }) {
  return <PortalChrome locale={await requestLocale()}>{children}</PortalChrome>;
}
