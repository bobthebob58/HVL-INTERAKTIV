/**
 * inertPage — what of a page, outside one of its frames, a keyboard or a screen reader can still reach: the elements
 * that take focus and the text that is read, and what Chromium's accessibility tree still exposes.
 *
 * Why: while the editor's save choice is open, its dialog is modal only inside its own frame (probe P7, D-093); the
 *      activity page makes everything around the frame `inert` so that Tab and a screen reader's browse mode cannot
 *      leave the dialog for the page behind it (UD-006, WCAG 2.4.3 and 1.3.2). The DOM says what `inert` covers; the
 *      accessibility tree says what assistive technology is actually given, so both are read.
 * Spec: UD-006, PROD-013
 * Invariants:
 *   - Only the top document is read: the frame and everything inside it are the dialog's side and are skipped.
 *   - Text counts when it is rendered (`checkVisibility`) and not under `aria-hidden`, so visually hidden text such as
 *     a status region's counts too; scripts and styles never count.
 *   - The accessibility tree is the main frame's (CDP `Accessibility.getFullAXTree` without a frame ID); a node counts
 *     when it is not ignored and is text, a heading, an image or a control.
 * Collaborators: ../axeSaveChoice.a11y.test.ts.
 * Tests: apps/server/a11y/axeSaveChoice.a11y.test.ts
 */
import type { Page } from 'playwright-core';

/** The roles in Chromium's accessibility tree that a person reads or operates. */
const CONTENT_ROLES: ReadonlySet<string> = new Set([
  'StaticText',
  'heading',
  'image',
  'img',
  'link',
  'button',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'tab',
  'menuitem',
  'switch',
  'status',
  'alert',
]);

/** Runs in the page: the focusable elements and the rendered text outside `inert`, the frame skipped. */
function outsideInert(frameSelector: string): string[] {
  const frame = document.querySelector(frameSelector);
  const tag = (el: Element) => `${el.tagName}${el.id ? `#${el.id}` : ''}`;
  const found: string[] = [];
  const focusable =
    'a[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]';
  for (const el of document.querySelectorAll(focusable)) {
    if (el === frame || el.closest('[inert]')) continue;
    found.push(`focusable ${tag(el)} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const text = (node.textContent ?? '').trim();
    if (!text || !parent || parent.closest('[inert], [aria-hidden=true], script, style, template')) continue;
    if (!parent.checkVisibility({ visibilityProperty: true })) continue;
    found.push(`text in ${tag(parent)} "${text.slice(0, 40)}"`);
  }
  return found;
}

/**
 * What a keyboard or a screen reader can still reach in the page outside a frame.
 * @param page - The page.
 * @param frameSelector - The frame that is left out, e.g. `iframe[src*="/h5p/edit/"]`.
 * @returns One line per focusable element and per rendered text outside `inert`; empty when all is inert.
 */
export const reachableOutsideFrame = (page: Page, frameSelector: string): Promise<string[]> =>
  page.evaluate(outsideInert, frameSelector);

/**
 * What Chromium's accessibility tree exposes of the page's own document (frames are trees of their own).
 * @param page - The page.
 * @returns One line per exposed text, heading, image or control, e.g. `link "Hjelp"`.
 */
export async function exposedInPage(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes
      .filter((node) => !node.ignored && CONTENT_ROLES.has(String(node.role?.value ?? '')))
      .map((node) => `${String(node.role?.value)} "${String(node.name?.value ?? '').slice(0, 40)}"`);
  } finally {
    await cdp.detach();
  }
}
