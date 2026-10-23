/**
 * LtiChrome — the frame of the Canvas page: the header with **Hjelp**, the `main` landmark and the footer with
 * **Personvern**, all opening in a new tab.
 *
 * Why: inside Canvas the page lives in an iframe whose launch would be lost by navigating it, so help and the privacy
 *      notice open in a new tab and say so (UD-007). Both stay in the same place as on every portal page (UD-013),
 *      and the privacy link is always on screen next to the player (DATA-006, D-067).
 * Spec: DATA-006, UD-013, UD-007, UD-006
 * Invariants:
 *   - Exactly one `main` with `id="main"`, like ../../components/PortalChrome.tsx.
 * Collaborators: ../../components/SiteHeader.tsx, ../../components/SiteFooter.tsx, ../../app/app/play/page.tsx.
 * Tests: apps/web/test/components/SiteFooter.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { ReactNode } from 'react';
import { MAIN_ID } from '../../components/PortalChrome';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';
import type { Locale } from '../../i18n/translate';

/**
 * The Canvas frame around the page.
 * @param props - The locale and the page.
 * @returns Header, main and footer.
 */
export function LtiChrome({ locale, children }: { readonly locale: Locale; readonly children: ReactNode }) {
  return (
    <>
      <SiteHeader locale={locale} inCanvas />
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        {children}
      </main>
      <SiteFooter locale={locale} inCanvas />
    </>
  );
}
