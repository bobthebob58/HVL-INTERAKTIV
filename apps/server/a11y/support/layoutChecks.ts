/**
 * layoutChecks — in-browser measurements for reflow and text resizing: horizontal scrolling in a page and its
 * frames, clipped text in a page and its frames, and the WCAG 1.4.12 text-spacing styles in every document.
 *
 * Why: UD-008 (1.4.10) forbids horizontal scrolling at 320 CSS px; UD-002 (1.4.4, 1.4.12) forbids lost text at
 *      200 % zoom and with larger line, paragraph, letter and word spacing, inside H5P too (UD-011). Both are only
 *      visible in a real layout. H5P clips on purpose (the slides of a presentation, a video, the pages of a book
 *      not shown), so inside its frames only what the change itself cuts off counts; that includes text the change
 *      pushes out of a box H5P already clips (CoursePresentation's root holds the whole player, footer included).
 * Spec: UD-008, UD-002
 * Invariants:
 *   - Overflow is measured on the document's scrolling element of the page and of every frame, with 1 px of
 *     rounding tolerance; the elements that stick out are named so a failure can be acted on.
 *   - Text counts as clipped when an element with text and `overflow` hidden or clip (or an ellipsis) has more
 *     content than box; visually hidden text (1 px boxes, `clip`/`clip-path`) is meant to be clipped and ignored.
 *   - In the top document every clipped text counts. In a frame, `markClippedText` first records each clipping
 *     element's overflow per axis in CSS px before the change (on the element itself, so a class H5P adds on resize
 *     does not matter). `clippedTextEverywhere` then reports every element that was not recorded, and a recorded
 *     one whose overflow on an axis grew by more than 2 px (overflow in fixed px stays the same at 200 % zoom).
 *     Limit: zoom shrinks an overflow that scales with its box (CoursePresentation's root, 24 px to 15 px), and a
 *     new cut smaller than that drop is not seen; with text spacing the boxes keep their size, so nothing is hidden.
 *   - The text-spacing styles are the ones of the 1.4.12 understanding document, added with `!important` to every
 *     document of the page, the frames H5P writes included.
 * Collaborators: the suites that use it (see Tests).
 * Tests: apps/server/a11y/reflowAndMotion.a11y.test.ts, apps/server/a11y/textSpacingZoom.a11y.test.ts
 */
import type { Frame, Page } from 'playwright-core';

/** The 1.4.12 text-spacing overrides (line 1.5, paragraphs 2 em, letters 0.12 em, words 0.16 em). */
export const TEXT_SPACING_CSS = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;

/** One document that scrolls sideways. */
export interface Overflow {
  /** The frame's address, or `page` for the top document. */
  readonly where: string;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  /** Up to five elements whose right edge is beyond the viewport. */
  readonly culprits: readonly string[];
}

/** Runs in the page: how far the document scrolls sideways, and what sticks out. */
function measureOverflow(): { scrollWidth: number; clientWidth: number; culprits: string[] } {
  const root = document.scrollingElement ?? document.documentElement;
  if (!document.body) return { scrollWidth: 0, clientWidth: 0, culprits: [] };
  const width = root.clientWidth;
  const culprits = [...document.body.querySelectorAll('*')]
    .filter((el) => el.getBoundingClientRect().right + scrollX > width + 1)
    .filter(
      (el) => !el.parentElement || el.parentElement.getBoundingClientRect().right + scrollX <= width + 1,
    )
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
  return { scrollWidth: root.scrollWidth, clientWidth: width, culprits };
}

/**
 * The documents of a page that scroll sideways.
 * @param page - A loaded page.
 * @returns One entry per document (page or frame) whose content is wider than its viewport.
 */
export async function horizontalOverflow(page: Page): Promise<Overflow[]> {
  const found: Overflow[] = [];
  for (const frame of page.frames()) {
    // WHY: H5P writes its editor iframe with document.write, so that frame's address stays about:blank.
    if (frame.isDetached()) continue;
    const m = await frame.evaluate(measureOverflow);
    if (m.scrollWidth > m.clientWidth + 1) {
      const where =
        frame === page.mainFrame()
          ? 'page'
          : frame.url().startsWith('about:')
            ? 'H5P editor iframe'
            : new URL(frame.url()).pathname;
      found.push({ where, ...m });
    }
  }
  return found;
}

/**
 * Runs in the page: elements whose text does not fit the box that clips it. `mark` records each one's overflow;
 * with `skipMarked`, a recorded element counts only when its overflow on an axis grew by more than 2 px.
 */
function findClippedText({ mark, skipMarked }: { mark: boolean; skipMarked: boolean }): string[] {
  type Recorded = { x: number; y: number };
  const clipped: string[] = [];
  for (const el of document.body?.querySelectorAll<HTMLElement>('*') ?? []) {
    const s = getComputedStyle(el);
    const clips = /hidden|clip/.test(`${s.overflowX} ${s.overflowY}`) || s.textOverflow === 'ellipsis';
    if (!clips || !el.textContent?.trim() || s.display === 'none' || s.visibility === 'hidden') continue;
    if (el.clientWidth <= 1 || el.clientHeight <= 1 || s.clip !== 'auto' || s.clipPath !== 'none') continue;
    const x = s.overflowX === 'visible' ? 0 : el.scrollWidth - el.clientWidth;
    const y = s.overflowY === 'visible' ? 0 : el.scrollHeight - el.clientHeight;
    if (x <= 1 && y <= 1) continue;
    const marked = el as HTMLElement & { __hvlClipped?: Recorded };
    const before = skipMarked ? marked.__hvlClipped : undefined;
    if (before && x <= before.x + 2 && y <= before.y + 2) continue;
    if (mark) marked.__hvlClipped = { x, y };
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    const grown = before ? ` (overflow ${before.x}×${before.y} px grew to ${x}×${y} px)` : '';
    clipped.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${text}"${grown}`);
  }
  return clipped;
}

/** A frame's name in a report: `page`, its path, or `H5P iframe` for one H5P wrote. */
const frameName = (page: Page, frame: Frame): string =>
  frame === page.mainFrame()
    ? 'page'
    : frame.url().startsWith('about:')
      ? 'H5P iframe'
      : new URL(frame.url()).pathname;

/**
 * Elements whose text is cut off in one document.
 * @param frame - The page's main frame or one of its frames.
 * @returns A description of each clipping element.
 */
export function clippedText(frame: Frame): Promise<string[]> {
  return frame.evaluate(findClippedText, { mark: false, skipMarked: false });
}

/**
 * Records, in every frame of a page (not the top document), the elements whose text is clipped now and by how
 * much they overflow, before a change such as zoom or text spacing.
 * @param page - A loaded page.
 * @returns What was clipped already, per frame, for the report.
 */
export async function markClippedText(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame() || frame.isDetached()) continue;
    const lines = await frame.evaluate(findClippedText, { mark: true, skipMarked: false });
    found.push(...lines.map((line) => `${frameName(page, frame)}: ${line}`));
  }
  return found;
}

/**
 * Clipped text in a page and its frames: all of it in the top document, and in each frame what `markClippedText`
 * did not record or what overflows a recorded box further than before.
 * @param page - A loaded page.
 * @returns One line per clipping element, with its document.
 */
export async function clippedTextEverywhere(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const skipMarked = frame !== page.mainFrame();
    const lines = await frame.evaluate(findClippedText, { mark: false, skipMarked });
    found.push(...lines.map((line) => `${frameName(page, frame)}: ${line}`));
  }
  return found;
}

/** A frame of the DevTools frame tree and its children. */
type FrameTree = { frame: { id: string }; childFrames?: FrameTree[] };

/**
 * Adds a style sheet to every document of a page, the way a reader's own style sheet or a text-spacing bookmarklet
 * extension does: through the browser (DevTools protocol), so the pages' Content Security Policy, which refuses
 * inline styles, stays on.
 * @param page - A loaded page; its main frame and every frame in it get the sheet.
 * @param css - The rules.
 * @returns How many documents got the sheet.
 */
export async function addUserStyles(page: Page, css: string): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const ids: string[] = [];
  const collect = (tree: FrameTree) => {
    ids.push(tree.frame.id);
    for (const child of tree.childFrames ?? []) collect(child);
  };
  collect(frameTree);
  for (const frameId of ids) {
    const { styleSheetId } = await cdp.send('CSS.createStyleSheet', { frameId });
    await cdp.send('CSS.setStyleSheetText', { styleSheetId, text: css });
  }
  await cdp.detach();
  return ids.length;
}
