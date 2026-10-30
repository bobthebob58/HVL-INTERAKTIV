/**
 * SiteHeader — the band at the top of every page: the site name (or HVL's logo, once configured), on portal pages the
 * studio's main menu, and **Hjelp**.
 *
 * Why: WCAG 3.2.6 (UD-013) wants help in the same place on every page, so the Hjelp link sits at the same spot in
 *      the header everywhere, also inside Canvas. In Canvas (`inCanvas`) the links open in a new tab, so the launch
 *      in the frame is not lost, and say so (UD-007). WCAG 3.2.3 wants the navigation in the same place on every
 *      page too, so the studio's menu (./StudioNav.tsx, D-089) follows the site name on every portal page.
 * Spec: UD-013, UD-007, UD-004, UD-008
 * Invariants:
 *   - The header is the `banner` landmark; its links are in labelled `nav`s: the main menu, then help.
 *   - The order is the same on every portal page: site name, main menu, Hjelp. Canvas has no main menu.
 *   - The help link carries the page's locale, so help opened in a new tab from Canvas keeps the language
 *     (../config/paths.ts `infoHref`).
 *   - The logo, when configured, has the site name as its alternative text (./../config/branding.ts).
 *   - On wide screens the header is sticky, and globals.css pads scrolling so focus is never hidden below it.
 * Collaborators: ./PortalChrome.tsx, ../features/lti/LtiChrome.tsx, ./StudioNav.tsx, ./ExternalLink.tsx,
 *   ../config/branding.ts.
 * Tests: apps/web/test/components/SiteHeader.test.tsx
 */
import Link from 'next/link';
import { brandLogo } from '../config/branding';
import { HELP_PATH, HOME_PATH, infoHref } from '../config/paths';
import { t, type Locale } from '../i18n/translate';
import { ExternalLink } from './ExternalLink';
import { StudioNav } from './StudioNav';

/** What the header needs. */
export interface SiteHeaderProps {
  readonly locale: Locale;
  /** The page runs inside Canvas: links open in a new tab, the site name is not a link and there is no main menu. */
  readonly inCanvas?: boolean;
}

/**
 * The site header.
 * @param props - The locale and whether the page is inside Canvas.
 * @returns The `banner` landmark.
 */
export function SiteHeader({ locale, inCanvas = false }: SiteHeaderProps) {
  const name = t('site.name', locale);
  const logo = brandLogo(locale);
  const mark = logo ? (
    // WHY: a configured logo is a static first-party file; Next.js's image optimiser is off (D-068).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.src} width={logo.width} height={logo.height} alt={name} />
  ) : (
    <span className="text-xl font-bold">{name}</span>
  );
  return (
    <header className="site-header">
      <div className="site-header-bar mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2">
        {inCanvas ? (
          mark
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={HOME_PATH} aria-label={t('site.home', locale)} className="no-underline">
              {mark}
            </Link>
            <StudioNav locale={locale} />
          </div>
        )}
        <nav aria-label={t('site.headerNav', locale)}>
          <ul className="m-0 flex list-none gap-4 p-0">
            <li>
              <ExternalLink
                href={infoHref(HELP_PATH, locale)}
                locale={locale}
                newTab={inCanvas}
                external={false}
                className="link-target"
              >
                {t('nav.help', locale)}
              </ExternalLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
