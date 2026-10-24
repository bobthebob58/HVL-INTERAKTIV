/**
 * focusInspect — runs in the page after each Tab press of ./focusWalk.ts: finds the element that has focus (through
 * same-origin iframes), reads how it looks focused, how the element focused before it looks now that it is not, and
 * whether the new one is in the viewport and not covered.
 *
 * Why: UD-004 (WCAG 2.4.7, 2.4.11) asks that every focused element shows a focus indicator and is not hidden. An
 *      element that carries a box-shadow at rest (ImageHotspots' hotspots, DragText's words, the editor's fields)
 *      looked "indicated" whether or not the ring was drawn, so focus is judged by the difference between the
 *      element's focused and unfocused look, read once each with its transitions finished (ImageHotspots fades
 *      every property in over 200 ms, so a reading right after the key press showed the resting look).
 * Spec: UD-004, UD-006
 * Invariants:
 *   - The walk's state (every element focused so far, each once, in the order reached) lives on the top window as
 *     `__hvlFocusWalk`; `seenAt` is the element's index there (by identity, so scrolling or a layout change cannot
 *     make one element look like two), -1 for a new one. A press that leaves focus on the same element adds
 *     nothing, so the list stays index for index with ./focusWalk.ts's stops.
 *   - A look is the outline (style, width, colour, offset) and the box-shadow; `ring` means an outline of at least
 *     2 px or any box-shadow. Only CSS transitions are finished; nothing else of the page is changed.
 *   - The rectangles of the element and of its ring (outline offset and width added) are clipped to each frame's
 *     viewport on the way up; "in the viewport" means that part of the ring is. "Covered" means that
 *     `elementFromPoint` at the centre and four inset corners of the visible part hits neither the element, a node
 *     inside it, one of its labels, nor (one level up) its frame (2.4.11 asks that it is not entirely hidden).
 * Collaborators: ./focusWalk.ts.
 * Tests: apps/server/a11y/keyboardFocus.a11y.test.ts
 */

/** What one inspection saw: the focused element (null when focus is on no element) and the previous one's rest. */
export interface FocusReading {
  readonly stop: {
    /** e.g. `BUTTON "Publiser"` inside `iframe "Spel: …"`. */
    readonly name: string;
    /** Whether the focused look has a ring (an outline of 2 px or more, or a box-shadow). */
    readonly ring: boolean;
    /** The focused look, e.g. `outline solid 3px rgb(0, 67, 87) 2px; shadow none`. */
    readonly look: string;
    readonly inViewport: boolean;
    readonly coveredBy?: string;
    /** Index of this element among the walk's earlier stops, -1 when it is new. */
    readonly seenAt: number;
  } | null;
  /** How the element focused at the previous press looks now, when focus has left it. */
  readonly previousRest?: string;
}

/**
 * Runs in the page: inspects the element that has focus now and records it for the next press.
 * @returns The reading.
 */
export function inspectFocus(): FocusReading {
  const top = window as unknown as { __hvlFocusWalk?: { elements: Element[] } };
  const walk = (top.__hvlFocusWalk ??= { elements: [] });
  const looks = (el: Element) => {
    for (const animation of el.getAnimations()) if ('transitionProperty' in animation) animation.finish();
    const s = getComputedStyle(el);
    const outlined = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
    const outline = outlined
      ? `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`
      : 'none';
    return { outlined, s, look: `outline ${outline}; shadow ${s.boxShadow || 'none'}` };
  };
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
  const focused = el && el !== doc.body && el !== doc.documentElement ? el : null;
  const previous = walk.elements.at(-1);
  const previousRest = previous && previous !== focused ? looks(previous).look : undefined;
  if (!focused) return { stop: null, ...(previousRest ? { previousRest } : {}) };
  const seenAt = walk.elements.indexOf(focused);
  // WHY: a press that leaves focus where it was is not a new stop; listing it twice would put `seenAt` out of step
  // with the walk's own stops, so a later repeat would look like a return to an earlier stop (a false cycle).
  if (walk.elements.at(-1) !== focused) walk.elements.push(focused);
  const { outlined, s: style, look } = looks(focused);
  // WHY: what a sighted user sees is the ring, which can lie outside a box of no height (CoursePresentation's slide).
  const grow = outlined
    ? Math.max(parseFloat(style.outlineOffset) || 0, 0) + parseFloat(style.outlineWidth)
    : 0;
  const own = focused.getBoundingClientRect();
  type Box = { left: number; top: number; right: number; bottom: number };
  let box: Box = { left: own.left, top: own.top, right: own.right, bottom: own.bottom };
  let ring: Box = {
    left: own.left - grow,
    top: own.top - grow,
    right: own.right + grow,
    bottom: own.bottom + grow,
  };
  const shift = (b: Box, r: DOMRect): Box => ({
    left: b.left + r.left,
    top: b.top + r.top,
    right: b.right + r.left,
    bottom: b.bottom + r.top,
  });
  const clip = (b: Box, w: number, h: number): Box => ({
    left: Math.max(b.left, 0),
    top: Math.max(b.top, 0),
    right: Math.min(b.right, w),
    bottom: Math.min(b.bottom, h),
  });
  // Clip the element's rectangle (and its ring's) to its own frame, then to each frame around it, up to the window.
  const levels: { doc: Document; target: Element; box: Box }[] = [];
  let current: Element = focused;
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
      coveredBy = hits[0] ? label(hits[0]) : 'nothing (outside the document)';
      break;
    }
  }
  const name = `${label(focused)}${frames.map((f) => ` in ${label(f)}`).join('')}`;
  const ringShown = outlined || (style.boxShadow !== 'none' && style.boxShadow !== '');
  const stop = { name, ring: ringShown, look, inViewport, seenAt, ...(coveredBy ? { coveredBy } : {}) };
  return { stop, ...(previousRest ? { previousRest } : {}) };
}
