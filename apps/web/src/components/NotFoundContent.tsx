/**
 * NotFoundContent — what a 404 page says: that the page does not exist, and a link to the start page.
 *
 * Why: two not-found pages show it. ../app/not-found.tsx answers a path no page has and brings the portal chrome;
 *      ../app/(portal)/not-found.tsx answers a portal page that calls `notFound()` (a pattern ID that cannot exist)
 *      inside the portal layout, which already has the chrome. Both must say the same thing, and say nothing about why
 *      the page is unknown, as the server's own 404 page does (AUTH-003).
 * Spec: AUTH-003, UD-013
 * Invariants:
 *   - One `h1`; no chrome of its own, so a page never has two `main` landmarks.
 * Collaborators: ../app/not-found.tsx, ../app/(portal)/not-found.tsx, ../config/paths.ts.
 * Tests: apps/server/test/web/webPages.browser.int.test.ts, apps/server/test/web/webApp.browser.int.test.ts
 */
import Link from 'next/link';
import { HOME_PATH } from '../config/paths';
import { t, type Locale } from '../i18n/translate';

/**
 * The not-found message.
 * @param props - The page locale.
 * @returns The heading, the explanation and the link home.
 */
export function NotFoundContent({ locale }: { readonly locale: Locale }) {
  return (
    <>
      <h1>{t('notFound.title', locale)}</h1>
      <p>{t('notFound.body', locale)}</p>
      <p>
        <Link href={HOME_PATH} className="link-target">
          {t('site.home', locale)}
        </Link>
      </p>
    </>
  );
}
