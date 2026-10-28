/**
 * skeletonCreationSettling — tells the browser probes P1 and P6 when an H5P page in Chromium has settled: H5P's
 * editor has built its whole form, or a value the player shows has stopped changing; and how long a page stays open
 * so that a late error is still reported.
 *
 * Why: a fixed pause long enough on a laptop can be too short for H5P's work on a busy CI runner. Each wait here is
 *      for a state H5P shows (nothing loading, nothing changing), so a slower runner makes the probes slower, never
 *      wrong.
 * Spec: PED-010, PROD-001
 * Invariants:
 *   - A value counts as settled only when it is defined and the same {@link SETTLE}.reads times in a row.
 *   - The editor counts as built only when no library, script or request is loading in its frame.
 *   - The one fixed wait, {@link LATE_ERROR_WINDOW_MS}, proves an absence (no late error) and never readiness.
 * Collaborators: ./skeletonCreationPages.ts (P1's editor and player), ./placeholderMarkerEditor.ts (P6's editor),
 *   apps/server/h5p/editor/scripts/h5peditor.js (the loading state it reads).
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts,
 *   apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts
 */
import type { Frame, Page } from 'playwright-core';
import { expect } from 'vitest';

/** How often a settling page is read, how many equal reads in a row count as settled, and the most to wait. */
export const SETTLE = { intervalMs: 200, reads: 3, timeoutMs: 60_000 } as const;

/**
 * How long a page stays open after its last step. WHY: absence. An error H5P raises late (from a timer or a request
 * that step started) must still be reported, and only waiting shows that none comes. H5P's deferred work runs within
 * a few hundred milliseconds (a group opens 100 ms after its click); 1 s leaves a margin of several times that, and
 * is as long as the pause the player probe first had.
 */
export const LATE_ERROR_WINDOW_MS = 1_000;

/**
 * Reads a value until it has settled.
 * @param read - Reads the value; null while the page shows that it is still busy.
 * @param what - Names the page in the error.
 * @returns The settled value.
 * @throws When the value has not settled within {@link SETTLE}.timeoutMs.
 */
export async function settled<T>(read: () => Promise<T | null>, what: string): Promise<T> {
  let value: T | null = null;
  let last = '';
  let same = 0;
  const equalReadsInARow = async (): Promise<number> => {
    // WHY: a read that fails (the page is navigating) breaks the row.
    value = await read().catch((error: unknown) => {
      [same, last] = [0, ''];
      throw error;
    });
    const now = value === null ? '' : JSON.stringify(value);
    same = now !== '' && now === last ? same + 1 : 0;
    last = now;
    return same + 1;
  };
  const options = {
    interval: SETTLE.intervalMs,
    timeout: SETTLE.timeoutMs,
    message: `${what} did not settle`,
  };
  await expect.poll(equalReadsInARow, options).toBeGreaterThanOrEqual(SETTLE.reads);
  return value as T;
}

/** In H5P's editor frame: null while a library, a script or a request is loading, else the number of elements. */
function editorProgress(): number | null {
  type Namespace = { $?: { active: number }; libraryCache?: object; libraryLoaded?: Record<string, boolean> };
  const ns = (window as unknown as { H5PEditor?: Namespace }).H5PEditor;
  if (!ns?.$ || !document.querySelector('.h5peditor-form')) return null;
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor.js
  // loadLibrary puts a library into libraryCache when it asks for its semantics (0 until they arrive), and
  // libraryRequested marks it in libraryLoaded once its scripts have run, just before its widgets are built.
  const loading = Object.keys(ns.libraryCache ?? {}).some((name) => !ns.libraryLoaded?.[name]);
  if (loading || ns.$.active > 0 || document.querySelector('.h5peditor-loading')) return null;
  return document.getElementsByTagName('*').length;
}

/**
 * Waits until H5P's editor on an editor page has built its whole form.
 * WHY: content-type editors (CoursePresentation, InteractiveVideo, BranchingScenario) load their own and their
 * sub-contents' libraries after the form appears, and set defaults as they build; so the editor counts as built once
 * nothing loads in its frame (library semantics, scripts, jQuery requests, H5P's throbber) and its document has
 * stopped growing.
 * @param page - The editor page, after `goto`.
 * @returns H5P's editor frame.
 * @throws When the frame is missing or the editor has not settled within {@link SETTLE}.timeoutMs.
 */
export async function builtEditor(page: Page): Promise<Frame> {
  const iframe = await page.waitForSelector('iframe.h5p-editor-iframe', { timeout: SETTLE.timeoutMs });
  const frame = await iframe.contentFrame();
  if (!frame) throw new Error('H5P editor frame not found');
  await settled(() => frame.evaluate(editorProgress), "H5P's editor");
  return frame;
}
