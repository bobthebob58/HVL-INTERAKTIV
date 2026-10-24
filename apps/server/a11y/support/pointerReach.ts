/**
 * pointerReach — whether a pointer can press the controls a selector matches in one document, and over how much of
 * each: every CSS pixel of a shown, enabled control's box is tried with `elementFromPoint`.
 *
 * Why: UD-008 (WCAG 1.4.10) asks that a view reflows at 320 CSS px without losing function, and UD-005 (2.5.8)
 *      that a pointer can press every control over at least 24 × 24 CSS px. A control that something lies over, or
 *      that its container clips, is pressed only where it shows; neither a size measurement (the box stays 24 px)
 *      nor a script's `element.click()` notices that, and Playwright's own click tries the centre only. This check
 *      covers controls that sit in a strip a library sizes as a share of the player (CoursePresentation's footer).
 * Spec: UD-008, UD-005
 * Invariants:
 *   - A control counts when part of its box is inside the document's viewport, it is not disabled (`:disabled`,
 *     `aria-disabled=true`) or `visibility: hidden`, and it takes pointer events.
 *   - A point hits a control when `elementFromPoint` gives it, a node inside it or one of its labels.
 *   - It can be pressed fully when the points that hit it span 24 rows and 24 columns (all of its rows and columns
 *     inside the viewport, if it is smaller): a round 24 px button passes, one that the bar's links or a clipping
 *     container cut to 11 rows does not.
 * Collaborators: apps/server/a11y/reflowAndMotion.a11y.test.ts, ./views.ts.
 * Tests: apps/server/a11y/reflowAndMotion.a11y.test.ts
 */
import type { Frame } from 'playwright-core';

/** What a check found: every control it judged, and those a pointer cannot press over 24 × 24 px. */
export interface PointerReach {
  /** e.g. `BUTTON "Neste side"`. */
  readonly controls: readonly string[];
  /** e.g. `BUTTON "Neste side" is pressed in 15 × 11 px only (elsewhere A "Undervegsvurdering er ikkje …")`. */
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
    const [left, top] = [Math.max(Math.floor(r.left), 0), Math.max(Math.floor(r.top), 0)];
    const [right, bottom] = [
      Math.min(Math.ceil(r.right), innerWidth),
      Math.min(Math.ceil(r.bottom), innerHeight),
    ];
    if (right - left < 1 || bottom - top < 1) continue;
    controls.push(name(el));
    const labels = 'labels' in el ? [...((el as HTMLInputElement).labels ?? [])] : [];
    const [rows, columns] = [new Set<number>(), new Set<number>()];
    const [boxRows, boxColumns] = [new Set<number>(), new Set<number>()];
    const others = new Map<string, number>();
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        // WHY: the box's own pixels only; a box that starts mid-pixel has no part of its first one.
        if (x + 0.5 < r.left || x + 0.5 > r.right || y + 0.5 < r.top || y + 0.5 > r.bottom) continue;
        boxRows.add(y);
        boxColumns.add(x);
        const hit = document.elementFromPoint(x + 0.5, y + 0.5);
        if (hit && (el.contains(hit) || labels.some((label) => label.contains(hit)))) {
          rows.add(y);
          columns.add(x);
        } else {
          const other = hit ? name(hit) : 'nothing';
          others.set(other, (others.get(other) ?? 0) + 1);
        }
      }
    }
    const needed = (count: number) => Math.min(24, count);
    if (rows.size >= needed(boxRows.size) && columns.size >= needed(boxColumns.size)) continue;
    const elsewhere = [...others].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'nothing';
    covered.push(`${name(el)} is pressed in ${columns.size} × ${rows.size} px only (elsewhere ${elsewhere})`);
  }
  return { controls, covered };
}

/**
 * Judges whether a pointer can press each control a selector matches in one document over 24 × 24 px.
 * @param frame - The document (an H5P player's frame, or a page's main frame).
 * @param selector - CSS selector of the controls.
 * @returns The controls judged and those a pointer reaches over less (covered or clipped).
 */
export function pointerReach(frame: Frame, selector: string): Promise<PointerReach> {
  return frame.evaluate(judgeControls, selector);
}
