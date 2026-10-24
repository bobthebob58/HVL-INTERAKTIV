/**
 * layoutChecks — in-browser measurements for reflow and text resizing: horizontal scrolling in a page and its
 * frames, clipped text, and the WCAG 1.4.12 text-spacing styles.
 *
 * Why: UD-008 (1.4.10) forbids horizontal scrolling at 320 CSS px; UD-002 (1.4.4, 1.4.12) forbids lost text at
 *      200 % zoom and with larger line, paragraph, letter and word spacing. Both are only visible in a real layout.
 * Spec: UD-008, UD-002
 * Invariants:
 *   - Overflow is measured on the document's scrolling element of the page and of every frame, with 1 px of
 *     rounding tolerance; the elements that stick out are named so a failure can be acted on.
 *   - Text counts as clipped when an element with text and `overflow` hidden or clip (or an ellipsis) has more
 *     content than box; visually hidden text (1 px boxes, `clip`/`clip-path`) is meant to be clipped and ignored.
 *   - The text-spacing styles are the ones of the 1.4.12 understanding document, added with `!important`.
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

/** Runs in the page: elements whose text does not fit the box that clips it. */
function findClippedText(): string[] {
  const clipped: string[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    const s = getComputedStyle(el);
    const clips = /hidden|clip/.test(`${s.overflowX} ${s.overflowY}`) || s.textOverflow === 'ellipsis';
    if (!clips || !el.textContent?.trim() || s.display === 'none' || s.visibility === 'hidden') continue;
    if (el.clientWidth <= 1 || el.clientHeight <= 1 || s.clip !== 'auto' || s.clipPath !== 'none') continue;
    const wide = s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
    const tall = s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1;
    if (wide || tall) {
      const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
      clipped.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${text}"`);
    }
  }
  return clipped;
}

/**
 * Elements whose text is cut off in one document.
 * @param frame - The page's main frame or one of its frames.
 * @returns A description of each clipping element.
 */
export function clippedText(frame: Frame): Promise<string[]> {
  return frame.evaluate(findClippedText);
}

/**
 * Adds a style sheet the way a reader's own style sheet or a text-spacing bookmarklet extension does: through the
 * browser (DevTools protocol), so the page's Content Security Policy, which refuses inline styles, stays on.
 * @param page - A loaded page (its main frame gets the sheet).
 * @param css - The rules.
 */
export async function addUserStyles(page: Page, css: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { styleSheetId } = await cdp.send('CSS.createStyleSheet', { frameId: frameTree.frame.id });
  await cdp.send('CSS.setStyleSheetText', { styleSheetId, text: css });
  await cdp.detach();
}
