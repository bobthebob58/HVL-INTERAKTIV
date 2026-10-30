/**
 * loadingState — waits until a page of the web app has nothing left to load: no status that still says its view is
 * loading («Hentar …», «Henter …», «Loading …»).
 *
 * Why: the web app's views read their data in the browser after hydration (D-068) and show `common.loading` in a
 *      status until the answer is there. Under CPU load the network goes idle while Next.js still hydrates, before the
 *      views send their requests, so a scan at network idle could check the loading state and pass while checking
 *      little of the page (S5 gate, under load).
 * Spec: UD-030
 * Invariants:
 *   - The texts come from the web app's own locale files, so pages in nn, nb and en are waited for alike.
 *   - Only a shown status counts: a hidden tab panel's view loads when its tab is chosen, and no check sees it.
 *   - A page that shows no loading text returns at once; one still loading after the timeout fails the test.
 * Collaborators: ./pages.ts (`openWebPage`), ./studioViews.ts, apps/web/src/i18n/locales/{nn,nb,en}.json.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts and the other suites in apps/server/a11y/.
 */
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';

const LOADING_TEXTS: readonly string[] = ['nn', 'nb', 'en'].map((locale) => {
  const file = new URL(`../../../web/src/i18n/locales/${locale}.json`, import.meta.url);
  return (JSON.parse(readFileSync(file, 'utf8')) as { common: { loading: string } }).common.loading;
});

/**
 * Waits until no status on the page says that its view is loading.
 * @param page - A page of the web app, in any of its languages.
 * @param timeout - How long to wait, in milliseconds.
 * @throws TimeoutError when a view is still loading after `timeout`.
 */
export async function waitUntilLoaded(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    (texts) =>
      ![...document.querySelectorAll('[role=status]')].some(
        (status) => status.getClientRects().length > 0 && texts.includes(status.textContent?.trim() ?? ''),
      ),
    LOADING_TEXTS,
    { timeout },
  );
}
