/**
 * PortalChrome — the frame of every portal page: header, the `main` landmark the skip link targets, and footer.
 *
 * Why: UD-006 needs a skip link target on every page (`<main id="main">`), UD-013 the Hjelp link in the same place,
 *      and DATA-006 the privacy link in the footer. One component keeps them identical on every portal page and on
 *      the not-found page.
 * Spec: UD-006, UD-013, DATA-006, UD-008
 * Invariants:
 *   - Exactly one `main` with `id="main"`; it takes focus from the skip link (`tabIndex={-1}`).
 *   - Content is at most 72rem wide and wraps at 320 px without horizontal scrolling (UD-008).
 * Collaborators: ./SiteHeader.tsx, ./SiteFooter.tsx, ../app/(portal)/layout.tsx, ../app/not-found.tsx.
 * Tests: apps/web/test/components/SiteHeader.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { ReactNode } from 'react';
import type { Locale } from '../i18n/translate';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** The `id` of every page's main landmark, which the skip link targets. */
export const MAIN_ID = 'main';

/**
 * The portal frame around a page.
 * @param props - The locale and the page.
 * @returns Header, main and footer.
 */
export function PortalChrome({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  return (
    <>
      <SiteHeader locale={locale} />
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
