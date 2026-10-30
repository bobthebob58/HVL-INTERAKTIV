/**
 * pages — opens what the accessibility suites check: the web app's routes, an activity page on one of its tabs,
 * the Canvas page of a real launch, and a server page inside a titled frame; each waits until its content is there.
 *
 * Why: a check on a half-loaded page proves nothing. Next.js hydrates after the first paint, the H5P player starts
 *      after its scripts, and the H5P editor builds its form inside a frame of a frame; the suites must all wait
 *      for the same signals. H5P's pages are always framed by a chrome page (D-067), so they are opened that way.
 * Spec: UD-030, UD-011, LTI-006
 * Invariants:
 *   - Frames are found by their address (`/h5p/play`, `/lti/play`, `/h5p/edit`, `/h5p/new`, `/lti/edit`), never
 *     by their translated titles, so the same helpers work in nn, nb and en.
 *   - `openFramed` and `openServerAnswer` serve their page only to the test's own browser context (Playwright
 *     routing) on the server's origin; the server is unchanged, and the framed page is a real same-origin load.
 * Collaborators: ../../test/support/realWebApp.ts, ./loadingState.ts, the suites in ../.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts and the other suites in apps/server/a11y/.
 */
import type { BrowserContext, Frame, Page } from 'playwright-core';
import type { RealWebApp, UiLocale } from '../../test/support/realWebApp.js';
import { waitUntilLoaded } from './loadingState.js';

/** The activity page's tabs by their Nynorsk names (apps/web `activity.tab*`). */
export const ACTIVITY_TABS = { play: 'Spel', edit: 'Rediger', check: 'Sjekk og publiser' } as const;

/** One of the activity page's tabs. */
export type ActivityTab = keyof typeof ACTIVITY_TABS;

const PLAYER_FRAME = 'iframe[src*="/h5p/play/"], iframe[src*="/lti/play"]';
const EDITOR_FRAME = 'iframe[src*="/h5p/edit/"], iframe[src*="/h5p/new"], iframe[src*="/lti/edit"]';

/**
 * Opens a path and waits until Next.js has hydrated, the network is quiet and, for a page of the web app, no view is
 * still loading (./loadingState.ts).
 * @param context - The browser context (signed in or not).
 * @param base - The server's origin.
 * @param path - The path, e.g. `/hjelp`.
 * @param nextPage - False for a page without Next.js: one Express renders itself (the Deep Linking picker), or one
 *   the helpers below serve.
 * @returns The page.
 */
export async function openWebPage(
  context: BrowserContext,
  base: string,
  path: string,
  nextPage = true,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${base}${path}`);
  if (nextPage) await page.waitForFunction(() => 'next' in window, undefined, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  if (nextPage) await waitUntilLoaded(page);
  return page;
}

/** The content frame of the iframe element `selector` matches, once it is attached. */
async function frameOf(host: Page | Frame, selector: string): Promise<Frame> {
  const element = await host.waitForSelector(selector, { state: 'attached', timeout: 30_000 });
  const frame = await element.contentFrame();
  if (!frame) throw new Error(`${selector} has no document`);
  return frame;
}

/**
 * Waits for the H5P player framed in a page and for H5P to start the activity.
 * @param page - A chrome page with a player frame.
 * @returns The player's frame.
 */
export async function playerFrame(page: Page): Promise<Frame> {
  const frame = await frameOf(page, PLAYER_FRAME);
  await frame.waitForFunction(
    () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
    undefined,
    { timeout: 30_000 },
  );
  return frame;
}

/**
 * Waits for the H5P editor framed in a page: the editor page, then H5P's own editor iframe with its form or, for a
 * new activity, the content-type list.
 * @param page - A chrome page with an editor frame.
 * @returns H5P's editor iframe.
 */
export async function editorFrame(page: Page): Promise<Frame> {
  const outer = await frameOf(page, EDITOR_FRAME);
  const inner = await frameOf(outer, 'iframe.h5p-editor-iframe');
  // WHY: an existing activity's editor keeps the content-type list in the page, hidden; only one of them shows.
  await inner
    .locator('.h5peditor-form, .h5p-hub-media')
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 45_000 });
  // WHY: some editors (Blanks' rich-text fields) keep requesting, so the network never goes quiet; the form is built
  // once it is visible, and a second lets its late widgets settle.
  await inner.waitForLoadState('load');
  await page.waitForTimeout(1000);
  return inner;
}

/**
 * Opens an activity page and selects one of its tabs with the mouse, then waits for the tab's content.
 * @param context - A signed-in browser context.
 * @param base - The server's origin.
 * @param contentId - The activity.
 * @param tab - Which tab.
 * @returns The page.
 */
export async function openActivityTab(
  context: BrowserContext,
  base: string,
  contentId: string,
  tab: ActivityTab,
): Promise<Page> {
  const page = await openWebPage(context, base, `/aktivitet/${contentId}`);
  if (tab !== 'play') await page.getByRole('tab', { name: ACTIVITY_TABS[tab] }).click();
  if (tab === 'play') await playerFrame(page);
  if (tab === 'edit') await editorFrame(page);
  if (tab === 'check') await page.getByRole('button', { name: 'Publiser', exact: true }).waitFor();
  if (tab !== 'edit') await page.waitForLoadState('networkidle');
  return page;
}

/**
 * Launches an activity from the mock Canvas and opens its Canvas page (`/app/play`) with the player.
 * @param context - A browser context without a portal session, as in Canvas.
 * @param app - The running server.
 * @param contentId - The activity.
 * @param options - Language of the launch; whether the teacher launches.
 * @returns The page.
 */
export async function openLaunch(
  context: BrowserContext,
  app: RealWebApp,
  contentId: string,
  options: { locale?: UiLocale; teacher?: boolean } = {},
): Promise<Page> {
  const ltik = await app.launch(contentId, options);
  const page = await openWebPage(context, app.base, `/app/play?ltik=${encodeURIComponent(ltik)}`);
  await playerFrame(page);
  await page.waitForLoadState('networkidle');
  return page;
}

/** Where the helpers below serve a page of their own; no server route has these paths. */
const HOST_PATH = '/__a11y-frame-host';
const ANSWER_PATH = '/__a11y-server-answer';

/** Opens `path` of the server's origin, answered for this context only with `html`. */
async function openServed(context: BrowserContext, base: string, path: string, html: string): Promise<Page> {
  await context.route(`${base}${path}`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
  );
  return openWebPage(context, base, path, false);
}

/**
 * Opens a server page as a frame of a minimal, titled host page of the same origin, as the chrome pages frame them.
 * @param context - The browser context.
 * @param base - The server's origin.
 * @param path - The framed page, e.g. `/h5p/play/<unknown id>`.
 * @param title - The frame's accessible name.
 * @returns The host page and the framed page's frame.
 */
export async function openFramed(
  context: BrowserContext,
  base: string,
  path: string,
  title: string,
): Promise<{ page: Page; frame: Frame }> {
  const host = `<!doctype html><html lang="nn"><head><meta charset="utf-8"><title>${title}</title></head><body><main><iframe title="${title}" src="${path}" style="width:100%;height:30rem;border:0"></iframe></main></body></html>`;
  const page = await openServed(context, base, HOST_PATH, host);
  const frame = await frameOf(page, 'iframe');
  await frame.waitForLoadState('load');
  return { page, frame };
}

/**
 * Shows an HTML answer the server gave outside a browser (e.g. to an LTI launch POST) on the server's origin, so its
 * stylesheets load as they would.
 * @param context - The browser context.
 * @param base - The server's origin.
 * @param html - The server's answer.
 * @returns The page.
 */
export const openServerAnswer = (context: BrowserContext, base: string, html: string): Promise<Page> =>
  openServed(context, base, ANSWER_PATH, html);
