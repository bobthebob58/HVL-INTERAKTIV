/**
 * openLanding — opens an address that carries an ltik in a browser page or frame the way a launch does: as a
 * navigation that one of our own pages started.
 *
 * Why: the landing pages take the ltik in their address only from a same-origin navigation (D-130,
 *      ../../src/lti/landingLtik.ts). Playwright's `goto` is a navigation the browser itself starts
 *      (`Sec-Fetch-Site: none`), which is refused like a typed or bookmarked address. A test that has an ltik in
 *      hand, and not a launch in progress, therefore first opens a page of the tool's own origin and lets that
 *      page navigate.
 * Spec: LTI-003
 * Invariants:
 *   - The first page is `/lti/keys` of the address's own origin (`TOOL_FIRST_PAGE`): it needs no sign-in, runs no
 *     script, and may be framed by Canvas, so the helper also works for the tool frame inside a Canvas page.
 *   - Returns once the landing page has loaded; a refused landing loads too (its «open it again» page).
 * Collaborators: ../../e2e/, ../../a11y/support/pages.ts, ../learningDesign/safeEditing/saveChoiceBench.ts.
 * Tests: used by apps/server/e2e/ltiEditor.e2e.test.ts, apps/server/e2e/safeEditReset.e2e.test.ts and
 *   apps/server/test/learningDesign/safeEditing/editorSaveDialogCanvas.browser.int.test.ts.
 */
import type { Frame, Page } from 'playwright-core';

/** A page of the tool that anyone may open and that Canvas may frame: ltijs's public key set. */
export const TOOL_FIRST_PAGE = '/lti/keys';

/**
 * Opens a landing address from a page of its own origin.
 * @param target - The page or frame to navigate.
 * @param url - The absolute landing address, with its `ltik`.
 */
export async function openLanding(target: Page | Frame, url: string): Promise<void> {
  await target.goto(`${new URL(url).origin}${TOOL_FIRST_PAGE}`);
  await Promise.all([
    target.waitForNavigation({ waitUntil: 'load' }),
    target.evaluate((to) => window.location.assign(to), url),
  ]);
}

/**
 * The address a frame is first given, when the page that holds it has another origin than the landing address.
 * @param hostUrl - The address of the page that holds the frame.
 * @param url - The landing address the frame is to show.
 * @returns `TOOL_FIRST_PAGE` of the tool when the host is another origin and the address carries an ltik; else `url`.
 */
export function frameFirstAddress(hostUrl: string, url: string): string {
  const tool = new URL(url).origin;
  return new URL(hostUrl).origin !== tool && url.includes('ltik=') ? `${tool}${TOOL_FIRST_PAGE}` : url;
}

/**
 * Lets a frame that was first given `frameFirstAddress` go on to its landing address, as a page of our own.
 * @param page - The page that holds the frame.
 * @param name - The frame's name.
 * @param url - The landing address.
 */
export async function arriveInFrame(page: Page, name: string, url: string): Promise<void> {
  const first = frameFirstAddress(page.url(), url);
  if (first === url) return;
  const element = await page.waitForSelector(`iframe[name="${name}"]`, { state: 'attached' });
  const frame = await element.contentFrame();
  if (!frame) throw new Error(`no frame named ${name}`);
  // WHY: until the first page has loaded the frame is `about:blank`, which still has the host page's origin.
  await frame.waitForURL(first);
  await frame.evaluate((to) => window.location.assign(to), url);
}

/**
 * Adds the tool's frame (`#tool_content`, as Canvas names it) to the end of a page and brings it to an address.
 * @param page - The page that is to hold the frame.
 * @param url - The address the frame is to show; one with an ltik is reached as after a launch.
 * @param css - The frame's size, as inline CSS.
 */
export async function addToolFrame(page: Page, url: string, css: string): Promise<void> {
  await page.evaluate(
    ({ src, style }) => {
      const frame = Object.assign(document.createElement('iframe'), {
        id: 'tool_content',
        name: 'tool_content',
      });
      Object.assign(frame, { src, title: 'HVL Interaktiv' });
      frame.style.cssText = style;
      document.body.append(frame);
    },
    { src: frameFirstAddress(page.url(), url), style: css },
  );
  await arriveInFrame(page, 'tool_content', url);
}
