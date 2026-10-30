/**
 * StudioNav — the header's main menu on every portal page: «Læringsdesign» for everyone, and «Planleggar»,
 * «Innhaldsbank» and «Mappe» once `GET /api/me` says the person is a signed-in author.
 *
 * Why: D-089 puts the studio's links in the header, in the same place on every portal page, so people find them
 *      where they found them last (WCAG 3.2.3, spec 03 §1). The guide is public; the planner, the bank and the
 *      portfolio are for authors, and the server refuses everyone else again. The web app never sees the session
 *      (D-068), so the menu asks the API in the browser who is signed in.
 * Spec: UD-013, UD-006, UD-005, UD-003
 * Invariants:
 *   - A labelled `nav` with a list of links, always in the order of `STUDIO_NAV_ITEMS`; author links are added, never
 *     reordered, so the guide link keeps its place.
 *   - The link of the current page has `aria-current="page"`; on a page below it (a pattern under the guide) it has
 *     `aria-current="true"`. Only one link is current: the longest path that matches, among all items. The current
 *     link is bold with a thicker underline, never marked by colour alone (../styles/components.css).
 *   - Signed out, or when the API cannot be asked, only the public link shows; the menu never blocks the page.
 *   - Not used in Canvas (../features/lti/LtiChrome.tsx): the studio's Canvas side waits for S6 (D-098).
 * Collaborators: ./SiteHeader.tsx, ../api/meApi.ts, ../api/portalSession.ts (`hasAuthorRole`), ../config/paths.ts.
 * Tests: apps/web/test/components/StudioNav.test.tsx
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getMe } from '../api/meApi';
import { hasAuthorRole } from '../api/portalSession';
import { BANK_PATH, GUIDE_PATH, MAPPE_PATH, PLANNER_PATH } from '../config/paths';
import { t, type Locale, type MessageKey } from '../i18n/translate';

/** One link of the main menu. */
export interface StudioNavItem {
  readonly href: string;
  readonly labelKey: MessageKey;
  /** Shown only to signed-in authors and admins. */
  readonly authorsOnly: boolean;
}

/** The main menu's links, in their fixed order (D-089). */
export const STUDIO_NAV_ITEMS: readonly StudioNavItem[] = [
  { href: GUIDE_PATH, labelKey: 'studio.navGuide', authorsOnly: false },
  { href: PLANNER_PATH, labelKey: 'studio.navPlanner', authorsOnly: true },
  { href: BANK_PATH, labelKey: 'studio.navBank', authorsOnly: true },
  { href: MAPPE_PATH, labelKey: 'studio.navMappe', authorsOnly: true },
];

/**
 * Which menu link the current page belongs to: the longest link path that is the page's path or a parent of it.
 * @param pathname - The page's path, e.g. `/laeringsdesign/monster/fa-video`; null outside the App Router.
 * @param hrefs - The link paths.
 * @returns The current link's path, or undefined.
 */
export function currentNavHref(pathname: string | null, hrefs: readonly string[]): string | undefined {
  if (!pathname) return undefined;
  const matching = hrefs.filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return matching.sort((a, b) => b.length - a.length)[0];
}

/**
 * The `aria-current` value of one menu link.
 * @param href - The link's path.
 * @param current - The current link's path (`currentNavHref`).
 * @param pathname - The page's path.
 * @returns `page` on the link's own page, `true` on a page below it, otherwise undefined.
 */
export const ariaCurrentFor = (
  href: string,
  current: string | undefined,
  pathname: string | null,
): 'page' | 'true' | undefined => {
  if (href !== current) return undefined;
  return pathname === href ? 'page' : 'true';
};

/**
 * The header's main menu.
 * @param props - The page locale.
 * @returns The labelled navigation.
 */
export function StudioNav({ locale }: { readonly locale: Locale }) {
  const pathname = usePathname();
  const [author, setAuthor] = useState(false);
  useEffect(() => {
    let active = true;
    void getMe({ kind: 'portal' }).then((result) => {
      if (active && result.ok) setAuthor(hasAuthorRole(result.data.roles));
    });
    return () => {
      active = false;
    };
  }, []);
  const current = currentNavHref(
    pathname,
    STUDIO_NAV_ITEMS.map((item) => item.href),
  );
  const items = STUDIO_NAV_ITEMS.filter((item) => author || !item.authorsOnly);
  return (
    <nav aria-label={t('studio.navLabel', locale)}>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={ariaCurrentFor(item.href, current, pathname)}
              className="link-target"
            >
              {t(item.labelKey, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
