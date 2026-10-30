/**
 * formativeNotice — the formative-use notice (PROD-011) next to the editor, as the suites find it: its Nynorsk
 * title and dismiss button, read from the web app's own locale file, and its labelled region on a page.
 *
 * Why: the notice shows until a person dismisses it, and the dismissal is stored per account. The suites' author
 *      used to be an account from an earlier run that had dismissed it, so no scan or keyboard walk ever saw it.
 *      The author is now new in every run (test/support/runFeideAuthor.ts); the suites that cover the notice assert
 *      that it shows before they check, so a notice that stops rendering fails instead of passing unseen.
 * Spec: PROD-011, UD-030, UD-006
 * Invariants:
 *   - The strings come from apps/web/src/i18n/locales/nn.json through the suites' one reader
 *     (../../test/support/webAppTexts.ts), so a reworded notice needs no change here.
 * Collaborators: apps/web/src/components/Notice.tsx, ../../test/support/webAppTexts.ts, ../axeWebRoutes.a11y.test.ts,
 *   ../keyboardJourneys.a11y.test.ts.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts, apps/server/a11y/keyboardJourneys.a11y.test.ts
 */
import type { Locator, Page } from 'playwright-core';
import { webText } from '../../test/support/webAppTexts.js';

/** The notice's Nynorsk title (its region's name) and dismiss button. */
export const FORMATIVE_NOTICE = {
  title: webText('notice.formativeUse.title'),
  dismiss: webText('notice.formativeUse.dismiss'),
} as const;

/**
 * The notice's labelled region on a page.
 * @param page - A page of the web app.
 * @returns The region, which matches nothing while the notice is hidden.
 */
export const noticeRegion = (page: Page): Locator =>
  page.getByRole('region', { name: FORMATIVE_NOTICE.title });
