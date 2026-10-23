/**
 * SiteFooter — the band at the bottom of every page, with the **Personvern** link to the privacy notice.
 *
 * Why: DATA-006 asks the player footer to link to a short privacy notice, and students meet the player in Canvas
 *      as well as in the portal. In Canvas (`inCanvas`) the link opens in a new tab, says so, and keeps the launch in
 *      the frame (UD-007).
 * Spec: DATA-006, UD-007, UD-013
 * Invariants:
 *   - The footer is the `contentinfo` landmark; its links are in a labelled `nav`.
 *   - The privacy link is on every page, in the same place.
 * Collaborators: ./PortalChrome.tsx, ../features/lti/LtiChrome.tsx, ./ExternalLink.tsx, ../app/(portal)/personvern.
 * Tests: apps/web/test/components/SiteFooter.test.tsx
 */
import { PRIVACY_PATH } from '../config/paths';
import { t, type Locale } from '../i18n/translate';
import { ExternalLink } from './ExternalLink';

/**
 * The site footer.
 * @param props - The locale and whether the page is inside Canvas.
 * @returns The `contentinfo` landmark.
 */
export function SiteFooter({
  locale,
  inCanvas = false,
}: {
  readonly locale: Locale;
  readonly inCanvas?: boolean;
}) {
  return (
    <footer className="mt-8 bg-hvl-band text-hvl-ink">
      <nav aria-label={t('site.footerNav', locale)} className="mx-auto max-w-6xl px-4 py-4">
        <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
          <li>
            {inCanvas ? (
              <ExternalLink href={PRIVACY_PATH} locale={locale} newTab external={false}>
                {t('nav.privacy', locale)}
              </ExternalLink>
            ) : (
              <a href={PRIVACY_PATH}>{t('nav.privacy', locale)}</a>
            )}
          </li>
        </ul>
      </nav>
    </footer>
  );
}
