/**
 * pointerReach — whether a pointer can press the controls a selector matches in one document: for each shown,
 * enabled control, what `elementFromPoint` hits at its centre and at four inset corners.
 *
 * Why: UD-008 (WCAG 1.4.10) asks that a view reflows at 320 CSS px without losing function, and UD-005 (2.5.8)
 *      that a pointer can press every control. A control that something else lies over cannot be pressed however
 *      large it is, and neither a size measurement nor a script's `element.click()` notices that. Playwright's own
 *      click refuses such a control, so the suites' pointer clicks find it too; this check covers the controls the
 *      suites do not click with a pointer (CoursePresentation's footer, which views.ts presses by keyboard).
 * Spec: UD-008, UD-005
 * Invariants:
 *   - A control counts when part of its box is inside the document's viewport, it is not disabled (`:disabled`,
 *     `aria-disabled=true`) or `visibility: hidden`, and it takes pointer events.
 *   - It can be pressed when at least one of the five points hits it, a node inside it or one of its labels (the
 *     points ./focusInspect.ts uses for "covered").
 * Collaborators: apps/server/a11y/reflowAndMotion.a11y.test.ts, ./views.ts.
 * Tests: apps/server/a11y/reflowAndMotion.a11y.test.ts
 */
import type { Frame } from 'playwright-core';

/** What a check found: every control it judged, and those a pointer cannot press. */
export interface PointerReach {
  /** e.g. `BUTTON "Neste side"`. */
  readonly controls: readonly string[];
  /** e.g. `BUTTON "Neste side" is under A "Undervegsvurdering er ikkje fullført"`. */
  readonly covered: readonly string[];
}

/** Runs in the page: judges every shown, enabled control `selector` matches. */
function judgeControls(selector: string): PointerReach {
  const name = (el: Element) =>
    `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  const controls: string[] = [];
  const covered: string[] = [];
  for (const el of document.querySelectorAll(selector)) {
    const style = getComputedStyle(el);
    if (el.matches(':disabled, [aria-disabled=true]') || style.visibility === 'hidden') continue;
    if (style.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    const [left, top] = [Math.max(r.left, 0), Math.max(r.top, 0)];
    const [right, bottom] = [Math.min(r.right, innerWidth), Math.min(r.bottom, innerHeight)];
    if (right - left < 1 || bottom - top < 1) continue;
    controls.push(name(el));
    const inset = Math.min(2, (right - left) / 4, (bottom - top) / 4);
    const points = [
      [(left + right) / 2, (top + bottom) / 2],
      [left + inset, top + inset],
      [right - inset, top + inset],
      [left + inset, bottom - inset],
      [right - inset, bottom - inset],
    ] as const;
    const labels = 'labels' in el ? [...((el as HTMLInputElement).labels ?? [])] : [];
    const hits = points.map(([x, y]) => document.elementFromPoint(x, y));
    const reached = hits.some((hit) => hit && (el.contains(hit) || labels.some((l) => l.contains(hit))));
    if (!reached) covered.push(`${name(el)} is under ${hits[0] ? name(hits[0]) : 'nothing'}`);
  }
  return { controls, covered };
}

/**
 * Judges whether a pointer can press each control a selector matches in one document.
 * @param frame - The document (an H5P player's frame, or a page's main frame).
 * @param selector - CSS selector of the controls.
 * @returns The controls judged and those something else lies over.
 */
export function pointerReach(frame: Frame, selector: string): Promise<PointerReach> {
  return frame.evaluate(judgeControls, selector);
}
