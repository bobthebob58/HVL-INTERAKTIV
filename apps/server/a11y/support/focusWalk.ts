/**
 * focusWalk — presses Tab through a page, into its same-origin frames (the H5P player and editor), and records for
 * every element that receives focus whether its focus indicator shows, whether it is in the viewport and whether
 * something else covers it.
 *
 * Why: UD-004 (WCAG 2.4.7, 2.4.11, 1.4.11) asks that every focused element is visible and not hidden behind the
 *      sticky header or anything else, and UD-006 (2.1.2) that focus never gets stuck. Only real key presses make
 *      `:focus-visible` match, so the walk uses the keyboard, never `element.focus()`.
 * Spec: UD-004, UD-006
 * Invariants:
 *   - The focused element is found by following `activeElement` through same-origin iframes; its rectangle, and
 *     that of its focus ring (outline offset and width added), are clipped to each frame's viewport on the way up;
 *     "in the viewport" means that part of the ring is.
 *   - "Covered" means that `elementFromPoint` at the centre and at four inset corners of the visible part returns
 *     neither the element, nor a node inside it, nor one of its labels, nor (one level up) its frame (2.4.11 asks
 *     that the element is not entirely hidden).
 *   - The walk stops after `maxStops` presses, when focus comes back to the first stop, or when it leaves the page.
 * Collaborators: the keyboard suites in ../ (`walkFocus`, and `tabTo`/`focusIs` for keyboard-only scripts).
 * Tests: apps/server/a11y/keyboardFocus.a11y.test.ts, apps/server/a11y/keyboardJourneys.a11y.test.ts
 */
import type { Page } from 'playwright-core';

/** One element that received focus. */
export interface FocusStop {
  /** e.g. `BUTTON "Publiser"` inside `iframe "Spel: …"`. */
  readonly name: string;
  /** Whether a focus indicator is drawn: an outline of at least 2 px, or a box-shadow. */
  readonly indicator: boolean;
  /** Whether part of the element is inside the viewport of the page and of every frame around it. */
  readonly inViewport: boolean;
  /** What covers the element entirely, if anything. */
  readonly coveredBy?: string;
}

/** Runs in the page: describes the element that has focus now, or returns null when focus is on no element. */
function inspectFocus(): (Omit<FocusStop, 'name'> & { name: string; key: string }) | null {
  const label = (el: Element): string => {
    const text = (el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.textContent ?? '').trim();
    return `${el.tagName}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${text.replace(/\s+/g, ' ').slice(0, 40)}"`;
  };
  let doc: Document = document;
  let el: Element | null = doc.activeElement;
  const frames: HTMLIFrameElement[] = [];
  // WHY: `instanceof HTMLIFrameElement` is false for an iframe of another frame's realm (H5P's editor iframe).
  while (el?.tagName === 'IFRAME' && (el as HTMLIFrameElement).contentDocument?.activeElement) {
    const frame = el as HTMLIFrameElement;
    frames.push(frame);
    doc = frame.contentDocument as Document;
    el = doc.activeElement;
  }
  if (!el || el === doc.body || el === doc.documentElement) return null;
  const style = getComputedStyle(el);
  const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
  const indicator = outline || (style.boxShadow !== 'none' && style.boxShadow !== '');
  // WHY: what a sighted user sees is the ring, which can lie outside a box of no height (CoursePresentation's slide).
  const grow = outline
    ? Math.max(parseFloat(style.outlineOffset) || 0, 0) + parseFloat(style.outlineWidth)
    : 0;
  // Clip the element's rectangle (and its ring's) to its own frame, then to each frame around it, up to the window.
  const own = el.getBoundingClientRect();
  let box = { left: own.left, top: own.top, right: own.right, bottom: own.bottom };
  let ring = {
    left: own.left - grow,
    top: own.top - grow,
    right: own.right + grow,
    bottom: own.bottom + grow,
  };
  const shift = (b: typeof box, r: DOMRect) => ({
    left: b.left + r.left,
    top: b.top + r.top,
    right: b.right + r.left,
    bottom: b.bottom + r.top,
  });
  const clip = (b: typeof box, w: number, h: number) => ({
    left: Math.max(b.left, 0),
    top: Math.max(b.top, 0),
    right: Math.min(b.right, w),
    bottom: Math.min(b.bottom, h),
  });
  const levels: { doc: Document; target: Element; box: typeof box }[] = [];
  let current: Element = el;
  let currentDoc = doc;
  for (let i = frames.length; i >= 0; i -= 1) {
    const view = currentDoc.defaultView;
    box = clip(box, view?.innerWidth ?? 0, view?.innerHeight ?? 0);
    ring = clip(ring, view?.innerWidth ?? 0, view?.innerHeight ?? 0);
    levels.push({ doc: currentDoc, target: current, box });
    const frame = frames[i - 1];
    if (!frame) break;
    box = shift(box, frame.getBoundingClientRect());
    ring = shift(ring, frame.getBoundingClientRect());
    current = frame;
    currentDoc = frame.ownerDocument;
  }
  const inViewport = ring.right - ring.left > 0 && ring.bottom - ring.top > 0;
  let coveredBy: string | undefined;
  for (const level of inViewport ? levels : []) {
    const { left, top, right, bottom } = level.box;
    const inset = Math.min(2, (right - left) / 4, (bottom - top) / 4);
    const points = [
      [(left + right) / 2, (top + bottom) / 2],
      [left + inset, top + inset],
      [right - inset, top + inset],
      [left + inset, bottom - inset],
      [right - inset, bottom - inset],
    ];
    const t = level.target;
    const labels = 'labels' in t ? [...((t as HTMLInputElement).labels ?? [])] : [];
    const hits = points.map(([x, y]) => level.doc.elementFromPoint(x ?? 0, y ?? 0));
    const shown = hits.some(
      (hit) => hit !== null && (t.contains(hit) || hit.contains(t) || labels.some((l) => l.contains(hit))),
    );
    if (!shown) {
      const hit = hits[0];
      coveredBy = hit ? label(hit) : 'nothing (outside the document)';
      break;
    }
  }
  const where = frames.map((f) => ` in ${label(f)}`).join('');
  const key = `${frames.length}:${label(el)}:${Math.round(own.left)},${Math.round(own.top)}`;
  return { name: `${label(el)}${where}`, key, indicator, inViewport, ...(coveredBy ? { coveredBy } : {}) };
}

/**
 * Tabs through a page from its start.
 * @param page - A loaded page; focus starts at the document.
 * @param maxStops - The most Tab presses.
 * @returns Every stop, and `trapped` when focus stayed on one element for three presses in a row.
 */
export async function walkFocus(
  page: Page,
  maxStops = 60,
): Promise<{ stops: FocusStop[]; trapped?: string }> {
  const stops: FocusStop[] = [];
  const keys: string[] = [];
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(inspectFocus);
    if (!stop) break;
    if (keys.length > 0 && stop.key === keys[0]) break;
    if (keys.length >= 2 && keys.slice(-2).every((k) => k === stop.key)) return { stops, trapped: stop.name };
    keys.push(stop.key);
    const { key: _key, ...rest } = stop;
    stops.push(rest);
  }
  return { stops };
}

/** Runs in the page: whether the element with focus, followed through same-origin frames, matches a selector. */
function focusMatches(selector: string): boolean {
  let el: Element | null = document.activeElement;
  while (el?.tagName === 'IFRAME' && (el as HTMLIFrameElement).contentDocument?.activeElement)
    el = (el as HTMLIFrameElement).contentDocument?.activeElement ?? null;
  return el?.matches(selector) ?? false;
}

/**
 * Presses Tab (or Shift+Tab) until the focused element matches a selector, as a keyboard user moves to a control.
 * @param page - The page.
 * @param selector - CSS selector of the wanted element, in whichever frame it is.
 * @param maxPresses - The most presses before giving up.
 * @param key - `Tab` or `Shift+Tab`.
 * @throws Error when the element is not reached.
 */
export async function tabTo(page: Page, selector: string, maxPresses = 60, key = 'Tab'): Promise<void> {
  for (let i = 0; i < maxPresses; i += 1) {
    await page.keyboard.press(key);
    if (await page.evaluate(focusMatches, selector)) return;
  }
  throw new Error(`${selector} was not reached with ${maxPresses} presses of ${key}`);
}

/**
 * Whether the element that has focus matches a selector.
 * @param page - The page.
 * @param selector - CSS selector.
 * @returns True when it matches.
 */
export const focusIs = (page: Page, selector: string): Promise<boolean> =>
  page.evaluate(focusMatches, selector);
