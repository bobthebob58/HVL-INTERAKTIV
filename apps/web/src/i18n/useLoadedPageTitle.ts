/**
 * useLoadedPageTitle — names a page in the document title once its view has loaded what the server could not know
 * (an activity's or a pattern's name), and keeps that title when React writes the server's title back.
 *
 * Why: WCAG 2.4.2 (UD-013): the server titles these pages "Aktivitet – HVL Interaktiv" and "Mønster – HVL
 *      Interaktiv", since the web app reads their data in the browser (D-068). React commits Next.js's metadata
 *      `<title>` when its boundary hydrates and then writes the server's title into the element. On a slow device that
 *      commit can come after the view has named the page (measured with the CPU slowed 4x: 1 load in 3; 20x: 3 in 3),
 *      and a one-off `document.title` assignment left the page with the server's title for good.
 * Spec: UD-013
 * Invariants:
 *   - Nothing changes while the title is unknown: the server's title stands.
 *   - While the view is mounted, the title is put back whenever the document title turns into `serverTitle`; any
 *     other title (the next page's, after a navigation) is left alone.
 *   - The watch ends when the title changes or the view unmounts; a title equal to `serverTitle` needs none.
 * Collaborators: ./pageTitle.ts, ../features/studio/PatternDetailView.tsx, ../features/activity/ActivityView.tsx.
 * Tests: apps/web/test/i18n/useLoadedPageTitle.test.tsx, apps/server/test/web/webChrome.browser.int.test.ts
 */
'use client';

import { useEffect } from 'react';

/**
 * Keeps the document title of a view whose name loads in the browser.
 * @param title - The page's full title once known (`pageTitle(name, locale)`), or undefined while it loads.
 * @param serverTitle - The full title the server rendered for the page, which React may write back.
 */
export function useLoadedPageTitle(title: string | undefined, serverTitle: string): void {
  useEffect(() => {
    if (!title) return;
    document.title = title;
    // WHY: React's write-back would change nothing, and writing the same title again would wake the observer again,
    // without end (a same-value write still replaces the `<title>`'s text node).
    if (title === serverTitle) return;
    // A11Y: WCAG 2.4.2: React's late commit of the metadata `<title>` writes the server's title back; restore ours.
    const observer = new MutationObserver(() => {
      if (document.title === serverTitle) document.title = title;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title, serverTitle]);
}
