/**
 * xapiCapturePage — what the xAPI probe test puts into the browser: the init script that listens for statements in
 * every frame, the same-origin host page that frames the player, and the read-out of the player's H5P facts.
 *
 * Why: probe P1 (D-102) must see a statement wherever it reaches a listener, so the listener is installed before any
 *      page script runs, in every frame, and marks an event object that reaches a second listener (H5P relays the
 *      same object from its own iframes, finding F3). The host page stands in for the web app's frame
 *      (apps/web H5pFrame) without changing the server under test.
 * Spec: H5P-009
 * Invariants:
 *   - The init script only listens: it wraps `window.H5P` and `H5P.externalDispatcher` in accessors that pass every
 *     value through, and H5P runs unchanged.
 *   - It sends the statement as H5P built it, and nothing about the page or the learner.
 * Collaborators: ./xapiCapture.ts (installs and reads them).
 * Tests: ../xapiQuestionTypes.browser.int.test.ts, ../xapiContainerTypes.browser.int.test.ts
 */
import type { Frame, Page } from 'playwright-core';

/** The binding the init script reports through. */
export const RECORD_BINDING = '__hvliXapiRecord';

/** Runs in every frame before H5P: traps `window.H5P` and its `externalDispatcher`, and listens for `xAPI`. */
export const CAPTURE_SCRIPT = String.raw`(() => {
  if (window.__hvliXapiCapture) return;
  Object.defineProperty(window, '__hvliXapiCapture', { value: true });
  const send = (kind, data) => { try { window.${RECORD_BINDING}(kind, data); } catch (e) {} };
  const listen = (dispatcher) => {
    if (!dispatcher || typeof dispatcher.on !== 'function' || dispatcher.__hvliXapiListening) return;
    Object.defineProperty(dispatcher, '__hvliXapiListening', { value: true });
    dispatcher.on('xAPI', (event) => {
      const seenBefore = event.__hvliXapiSeen === true;
      try { Object.defineProperty(event, '__hvliXapiSeen', { value: true }); } catch (e) {}
      send('xapi', { json: JSON.stringify(event.data.statement), seenBefore });
    });
  };
  const watch = (h5p) => {
    if (!h5p || typeof h5p !== 'object' || h5p.__hvliXapiWatched) return;
    Object.defineProperty(h5p, '__hvliXapiWatched', { value: true });
    let dispatcher = h5p.externalDispatcher;
    Object.defineProperty(h5p, 'externalDispatcher', { configurable: true, enumerable: true,
      get: () => dispatcher, set: (value) => { dispatcher = value; listen(value); } });
    listen(dispatcher);
  };
  let h5p = window.H5P;
  Object.defineProperty(window, 'H5P', { configurable: true, enumerable: true,
    get: () => h5p, set: (value) => { h5p = value; watch(value); } });
  watch(h5p);
})();`;

/**
 * The host page: one same-origin iframe with the player, as the web app frames it.
 * @param contentId - The activity.
 * @returns The page's HTML.
 */
export function hostPage(contentId: string): string {
  return (
    `<!doctype html><html lang="nn"><head><meta charset="utf-8"><title>Vert</title></head><body>` +
    `<iframe title="Aktivitet" src="/h5p/play/${encodeURIComponent(contentId)}" ` +
    `style="display:block;width:1000px;height:900px;border:0"></iframe></body></html>`
  );
}

/** What the player page's H5P says about embedding and reporting, read once per view. */
export interface PlayerFacts {
  /** The main library as H5PIntegration names it, e.g. `H5P.MultiChoice 1.16`. */
  readonly library: string;
  readonly topHasH5P: boolean;
  readonly isFramed: boolean;
  readonly externalEmbed: unknown;
  /** `<iframe class="h5p-iframe">` elements H5P wrote into the player document. */
  readonly h5pIframes: number;
  readonly reportingIsEnabled: unknown;
  readonly contentUserDataUrl: string;
}

/**
 * Reads the facts the bridge will depend on from the player document and the top window.
 * @param page - The host page.
 * @param player - The player document's frame.
 * @returns The facts.
 */
export async function readPlayerFacts(page: Page, player: Frame): Promise<PlayerFacts> {
  // WHY: the capture script defines `window.H5P` as an accessor in every frame, so `'H5P' in window` is always true.
  const topHasH5P = await page.evaluate(() => (window as { H5P?: unknown }).H5P !== undefined);
  const inPlayer = await player.evaluate(() => {
    const w = window as unknown as {
      H5P: { isFramed: boolean; externalEmbed: unknown };
      H5PIntegration: {
        reportingIsEnabled?: unknown;
        ajax: { contentUserData: string };
        contents: Record<string, { library: string }>;
      };
    };
    return {
      library: Object.values(w.H5PIntegration.contents)[0]?.library ?? '',
      isFramed: w.H5P.isFramed,
      externalEmbed: w.H5P.externalEmbed,
      h5pIframes: document.querySelectorAll('iframe.h5p-iframe').length,
      reportingIsEnabled: w.H5PIntegration.reportingIsEnabled,
      contentUserDataUrl: w.H5PIntegration.ajax.contentUserData,
    };
  });
  return { topHasH5P, ...inPlayer };
}
