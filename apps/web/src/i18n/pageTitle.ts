/**
 * pageTitle — the document title of a web page: the page's own name, then the site name ("Hjelp – HVL Interaktiv").
 *
 * Why: WCAG 2.4.2 Page Titled (level A, spec 03 §1 "WCAG 2.2 AA in full"): browser tabs, window lists and screen
 *      readers name a page by its title, so pages that all said "HVL Interaktiv" could not be told apart. The server
 *      pages already use the same "<page> – HVL Interaktiv" pattern; the manual protocol's step J1.4 expects the
 *      activity's title. Server pages set it through Next.js metadata (the root layout's template), the client-loaded
 *      activity page sets it once the activity has loaded.
 * Spec: UD-006, UD-013, PROD-012
 * Invariants:
 *   - The page's name comes first, so the part that differs is read first; the site name follows after " – ".
 *   - The start page keeps the site name alone (its `h1` is the site name).
 * Collaborators: ../app/layout.tsx (template), the pages under ../app, ./useLoadedPageTitle.ts (a title that loads in
 *   the browser), ../features/activity/ActivityView.tsx.
 * Tests: apps/web/test/i18n/pageTitle.test.ts, apps/server/test/web/webChrome.browser.int.test.ts
 */
import { t, type Locale } from './translate';

/** What separates the page's name from the site name. */
export const TITLE_SEPARATOR = ' – ';

/**
 * The document title of a page.
 * @param name - The page's own name, e.g. the activity's title; Next.js's template passes `%s`.
 * @param locale - The page locale.
 * @returns e.g. `Personvern – HVL Interaktiv`.
 */
export const pageTitle = (name: string, locale: Locale): string =>
  `${name}${TITLE_SEPARATOR}${t('site.name', locale)}`;
