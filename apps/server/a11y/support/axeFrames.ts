/**
 * axeFrames — which of a page's frames an axe scan reached: every frame its results' targets lead into, compared
 * with the shown frames that hold H5P (the player or editor page, and the iframes H5P writes).
 *
 * Why: UD-030 and UD-011 ask for axe inside the iframe of every content type. @axe-core/playwright 4.13 injects axe
 *      into each child frame within 1 s and drops a frame that fails (or reloads) in an empty `catch`; axe reports
 *      that only through its `frame-tested` rule, which is not a WCAG rule. A scan of the chrome page alone would
 *      therefore pass a player scan, so ./axeScan.ts asks this module and fails instead.
 * Spec: UD-030, UD-011
 * Invariants:
 *   - A frame counts as scanned when a result node's frame chain (`target` without its last part) resolves to it,
 *     or passes through it; the chain is resolved in the live page, frame by frame.
 *   - Only frames axe itself would enter are demanded: shown (a box, not `visibility: hidden`, not inside
 *     `aria-hidden`), with every frame around them shown too.
 * Collaborators: ./axeScan.ts.
 * Tests: apps/server/a11y/axeContentTypes.a11y.test.ts (a control scan that cannot enter frames must fail).
 */
import type { AxeResults, NodeResult } from 'axe-core';
import type { ElementHandle, Frame, Page } from 'playwright-core';

/** What marks a document as H5P's: the player's content, the editor, or the iframes H5P writes them into. */
const H5P_DOCUMENT = '.h5p-content, .h5peditor, iframe.h5p-iframe, iframe.h5p-editor-iframe';

/** Whether a frame and every frame around it is shown to screen readers, the frames axe enters. */
async function shownFrame(frame: Frame): Promise<boolean> {
  for (let f: Frame | null = frame; f?.parentFrame(); f = f.parentFrame()) {
    const element = await f.frameElement();
    const shown = await element.evaluate(
      (el: Element) =>
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== 'hidden' &&
        !el.closest('[aria-hidden="true"]'),
    );
    if (!shown) return false;
  }
  return true;
}

/**
 * The frames of a page that hold H5P, are shown, and that no result of a scan reaches into.
 * @param page - The scanned page.
 * @param results - What axe returned for it.
 * @returns Each such frame's address (`about:blank` for an iframe H5P wrote), empty when every one was scanned.
 */
export async function unscannedH5pFrames(page: Page, results: AxeResults): Promise<string[]> {
  const chains = new Map<string, NodeResult['target']>();
  for (const result of [...results.passes, ...results.violations, ...results.incomplete]) {
    for (const node of result.nodes) chains.set(JSON.stringify(node.target.slice(0, -1)), node.target);
  }
  const scanned = new Set<Frame>([page.mainFrame()]);
  for (const target of chains.values()) {
    let frame: Frame | null = page.mainFrame();
    for (const part of target.slice(0, -1)) {
      // WHY: a part inside shadow DOM is a list of selectors; Playwright's CSS reaches into open shadow roots.
      const selector = Array.isArray(part) ? String(part.at(-1)) : String(part);
      const element: ElementHandle | null | undefined = await frame?.$(selector);
      frame = (await element?.contentFrame()) ?? null;
      if (frame) scanned.add(frame);
    }
  }
  const missing: string[] = [];
  for (const frame of page.frames()) {
    if (scanned.has(frame) || frame.isDetached()) continue;
    // WHY: a frame that went away meanwhile (H5P rebuilding) holds nothing any scan could have reached.
    const holdsH5p = await frame
      .evaluate((s) => document.querySelector(s) !== null, H5P_DOCUMENT)
      .catch(() => false);
    if (holdsH5p && (await shownFrame(frame).catch(() => false)))
      missing.push(frame.url().split('?')[0] ?? '');
  }
  return missing;
}
