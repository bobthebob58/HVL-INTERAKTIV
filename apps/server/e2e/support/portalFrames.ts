/**
 * portalFrames — finds the frames of the portal's activity page that the S5 flows work in: the editor page on the
 * **Rediger** tab (`/h5p/edit/<id>`) with H5P's form inside it once it is built, the player frame of a page, and
 * the element that has focus through the frames.
 *
 * Why: a flow that edits through the real editor must wait for H5P's form, not for a fixed time, and must say where
 *      focus went after «Gå til feltet» (PROD-003); the portal's frames are on the tool's own origin, so the page can
 *      follow focus into them.
 * Spec: NFR-004, PROD-003, PROD-013
 * Invariants:
 *   - A frame is found by the path of its address, never by its position; a detached frame never counts.
 *   - The form counts as built when H5P's editor has nothing loading and its document has stopped growing
 *     (../../test/learningDesign/patterns/skeletonCreationSettling.ts `settled`).
 * Collaborators: playwright-core 1.56.1, ../../test/learningDesign/patterns/skeletonCreationSettling.ts.
 * Tests: apps/server/e2e/patternToPublish.e2e.test.ts, apps/server/e2e/safeEditReset.e2e.test.ts
 */
import type { Frame, Page } from 'playwright-core';
import { expect } from 'vitest';
import { settled } from '../../test/learningDesign/patterns/skeletonCreationSettling.js';

/** The path of a frame's address (`about:blank` has none of ours). */
export const pathOf = (url: string): string => (url.startsWith('http') ? new URL(url).pathname : url);

/**
 * Waits for the live frame whose address has `path`.
 * @param page - The page that holds it.
 * @param path - e.g. `/h5p/edit/<id>` or `/lti/play`.
 * @returns The frame.
 */
export async function frameAt(page: Page, path: string): Promise<Frame> {
  const find = () => page.frames().find((frame) => !frame.isDetached() && pathOf(frame.url()) === path);
  await expect.poll(() => find() !== undefined, { timeout: 45_000 }).toBe(true);
  return find() as Frame;
}

/** In H5P's form frame: null while anything loads, else the number of elements. */
const formProgress = (): number | null => {
  const ns = (window as unknown as { H5PEditor?: { $?: { active: number } } }).H5PEditor;
  if (!ns?.$ || !document.querySelector('.h5peditor-form')) return null;
  if (ns.$.active > 0 || document.querySelector('.h5peditor-loading')) return null;
  return document.getElementsByTagName('*').length;
};

/**
 * The portal's editor frame for an activity and H5P's form inside it, once the form is built.
 * @param page - The activity page with **Rediger** selected.
 * @param contentId - The activity.
 * @returns The editor page's frame and H5P's form frame.
 */
export async function editorFrames(page: Page, contentId: string): Promise<{ editor: Frame; form: Frame }> {
  const editor = await frameAt(page, `/h5p/edit/${contentId}`);
  const iframe = await editor.waitForSelector('iframe.h5p-editor-iframe', { timeout: 60_000 });
  const form = await iframe.contentFrame();
  if (!form) throw new Error("H5P's editor frame did not load");
  await settled(() => form.evaluate(formProgress), "H5P's editor");
  return { editor, form };
}

/** What has focus, followed through the page's frames. */
export interface DeepFocus {
  /** The focused element's tag, e.g. `INPUT`, or `nothing`. */
  readonly tag: string;
  /** Its classes, for a failure message. */
  readonly className: string;
  /** Whether a person can type into it (a text field or a rich-text editor). */
  readonly typable: boolean;
}

/**
 * Where focus is, followed through same-origin frames.
 * @param page - The page.
 * @returns The innermost focused element's tag and whether it takes text.
 */
export const deepFocus = (page: Page): Promise<DeepFocus> =>
  page.evaluate(() => {
    let element: Element | null = document.activeElement;
    while (element?.tagName === 'IFRAME')
      element = (element as HTMLIFrameElement).contentDocument?.activeElement ?? null;
    // WHY: not `instanceof HTMLElement`: an element of a frame belongs to that frame's realm, not the page's.
    const html = element as HTMLElement | null;
    const typable = Boolean(
      html && (html.isContentEditable || html.tagName === 'TEXTAREA' || html.tagName === 'INPUT'),
    );
    return { tag: element?.tagName ?? 'nothing', className: String(element?.className ?? ''), typable };
  });
