/**
 * targetSizes — measures every pointer target in a document against WCAG 2.5.8 (Target Size, Minimum): at least
 * 24 × 24 CSS px, or one of the criterion's exceptions, which are named in the result rather than passed silently.
 *
 * Why: UD-005 asks for a measurement script over interactive elements. 2.5.8 allows a smaller target when a 24 px
 *      circle on its centre touches no other target or circle (spacing), when it is a link inside a sentence
 *      (inline), or when its size is the browser's own (user agent); the report must say which applied, so the
 *      H5P exceptions are listed honestly (QuestionSet's progress dots rely on spacing, D-072 notes).
 * Spec: UD-005
 * Invariants:
 *   - A target is a link, button, form field, summary, an element with an interactive ARIA role or a positive or
 *     zero tabindex, that is rendered (non-zero box, not `visibility: hidden`, pointer events on).
 *   - A visually hidden checkbox or radio is measured by its label, which is what the pointer hits.
 *   - Slider thumbs (`role=slider`, `input[type=range]`) are listed as sliders: 2.5.8 judges a slider by its
 *     track and its keyboard alternative, which a person must confirm (UD-031).
 *   - `measureTargetsEverywhere` measures the page and each frame in it (H5P's player and editor pages and the
 *     iframes H5P writes) in its own document, and names each target with its document.
 * Collaborators: apps/server/a11y/targetSize.a11y.test.ts (prints the exceptions).
 * Tests: apps/server/a11y/targetSize.a11y.test.ts
 */
import type { Frame, Page } from 'playwright-core';

/** How a target meets 2.5.8, or that it does not. */
export type TargetVerdict = 'size' | 'spacing' | 'inline' | 'slider' | 'fails';

/** One measured target. */
export interface MeasuredTarget {
  /** e.g. `A "Hjelp"` or `BUTTON[role=tab] "Spel"`. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly verdict: TargetVerdict;
}

/** Runs in the page: measures every target of the document. */
function measureDocument(minimum: number): MeasuredTarget[] {
  const SELECTOR = [
    'a[href]',
    'button',
    'input:not([type=hidden])',
    'select',
    'textarea',
    'summary',
    '[role=button]',
    '[role=link]',
    '[role=checkbox]',
    '[role=radio]',
    '[role=tab]',
    '[role=switch]',
    '[role=menuitem]',
    '[role=option]',
    '[role=slider]',
    '[tabindex]:not([tabindex^="-"])',
  ].join(',');
  const name = (el: Element) =>
    `${el.tagName}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(
      el.getAttribute('aria-label') ??
      el.textContent ??
      ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40)}"`;
  const rendered = (el: Element, r: DOMRect) => {
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.pointerEvents !== 'none';
  };
  const boxOf = (el: Element): DOMRect => {
    const r = el.getBoundingClientRect();
    const input = el as HTMLInputElement;
    const hidden = r.width <= 2 || r.height <= 2 || getComputedStyle(el).opacity === '0';
    if (/^(checkbox|radio)$/.test(input.type ?? '') && hidden && input.labels?.[0]) {
      return input.labels[0].getBoundingClientRect();
    }
    return r;
  };
  const els = [...document.querySelectorAll(SELECTOR)].filter(
    (el, _i, all) =>
      !all.some((other) => other !== el && other.contains(el) && other.matches('a[href], button')),
  );
  const targets = els
    .map((el) => ({ el, r: boxOf(el) }))
    .filter(({ el, r }) => rendered(el, r) && r.bottom + scrollY > 0 && r.right + scrollX > 0);
  const centre = (r: DOMRect) => [(r.left + r.right) / 2, (r.top + r.bottom) / 2] as const;
  const distanceToRect = ([x, y]: readonly [number, number], r: DOMRect) =>
    Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
  const small = (r: DOMRect) => r.width < minimum - 0.5 || r.height < minimum - 0.5;
  return targets.map(({ el, r }) => {
    const base = { name: name(el), width: Math.round(r.width), height: Math.round(r.height) };
    if (!small(r)) return { ...base, verdict: 'size' as const };
    if (el.matches('[role=slider], input[type=range]')) return { ...base, verdict: 'slider' as const };
    const parentText = el.parentElement?.textContent?.trim().length ?? 0;
    const inline = el.matches('a[href]') && getComputedStyle(el).display === 'inline';
    if (inline && parentText > (el.textContent?.trim().length ?? 0))
      return { ...base, verdict: 'inline' as const };
    const c = centre(r);
    const clear = targets.every(({ el: other, r: o }) => {
      if (other === el || other.contains(el) || el.contains(other)) return true;
      const [ox, oy] = centre(o);
      return (
        distanceToRect(c, o) >= minimum / 2 && (!small(o) || Math.hypot(c[0] - ox, c[1] - oy) >= minimum)
      );
    });
    return { ...base, verdict: clear ? ('spacing' as const) : ('fails' as const) };
  });
}

/**
 * Measures the targets of one document (a page or one of its frames).
 * @param frame - The page's main frame or an H5P frame.
 * @param minimum - The minimum size in CSS px; 24 for 2.5.8.
 * @returns Every target with its verdict.
 */
export function measureTargets(frame: Frame, minimum = 24): Promise<MeasuredTarget[]> {
  return frame.evaluate(measureDocument, minimum);
}

/**
 * Measures the targets of a page and of every frame in it, each in its own document.
 * @param page - A loaded page.
 * @param minimum - The minimum size in CSS px; 24 for 2.5.8.
 * @returns Every target, its name prefixed with its document (`page`, the frame's path, or `H5P iframe`).
 */
export async function measureTargetsEverywhere(page: Page, minimum = 24): Promise<MeasuredTarget[]> {
  const found: MeasuredTarget[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const where =
      frame === page.mainFrame()
        ? 'page'
        : frame.url().startsWith('about:')
          ? 'H5P iframe'
          : new URL(frame.url()).pathname;
    const targets = await measureTargets(frame, minimum);
    found.push(...targets.map((target) => ({ ...target, name: `${where}: ${target.name}` })));
  }
  return found;
}
