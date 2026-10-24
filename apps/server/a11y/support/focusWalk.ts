/**
 * focusWalk — presses Tab through a page, into its same-origin frames (the H5P player and editor), and records for
 * every element that receives focus whether a focus indicator appears on it, whether it is in the viewport and
 * whether something else covers it, and whether the walk went all the way round.
 *
 * Why: UD-004 (WCAG 2.4.7, 2.4.11, 1.4.11) asks that every focused element is visible and not hidden behind the
 *      sticky header or anything else, and UD-006 (2.1.2) that focus never gets stuck. Only real key presses make
 *      `:focus-visible` match, so the walk uses the keyboard, never `element.focus()`. A walk that stops at its
 *      press limit, or circles among a few elements, has not shown either, so it says so instead of passing.
 * Spec: UD-004, UD-006
 * Invariants:
 *   - Each press is inspected in the page (./focusInspect.ts). A stop has an indicator when its focused look has
 *     a ring and differs from its look once focus has moved on (read at the next press).
 *   - `complete` is true only when focus came back to the first stop or left the page; `trapped` names the element
 *     when focus stayed on it for three presses, or came back to an earlier stop other than the first (a cycle that
 *     never returns to the page). The walk stops at either, or after `maxStops` presses.
 * Collaborators: ./focusInspect.ts; the keyboard suites in ../ (`walkFocus`, and `tabTo`/`focusIs` for
 *   keyboard-only scripts).
 * Tests: apps/server/a11y/keyboardFocus.a11y.test.ts, apps/server/a11y/keyboardJourneys.a11y.test.ts
 */
import type { Page } from 'playwright-core';
import { inspectFocus, type FocusReading } from './focusInspect.js';

/** One element that received focus. */
export interface FocusStop {
  /** e.g. `BUTTON "Publiser"` inside `iframe "Spel: …"`. */
  readonly name: string;
  /** Whether a focus indicator is drawn: a ring (outline of 2 px or more, or a box-shadow) it lacks unfocused. */
  readonly indicator: boolean;
  /** The focused look, when it is the same as the unfocused one. */
  readonly unchanged?: string;
  /** Whether part of the element is inside the viewport of the page and of every frame around it. */
  readonly inViewport: boolean;
  /** What covers the element entirely, if anything. */
  readonly coveredBy?: string;
}

/** What a walk found. */
export interface FocusWalk {
  readonly stops: FocusStop[];
  /** True when focus came back to the first stop or left the page. */
  readonly complete: boolean;
  /** The element focus stayed on, or came back to without returning to the start. */
  readonly trapped?: string;
}

type Reached = NonNullable<FocusReading['stop']>;

/** A stop of the walk, judged against how the element looked once focus had left it. */
const judged = (stop: Reached, rest: string | undefined): FocusStop => {
  const unchanged = rest === undefined || rest === stop.look;
  return {
    name: stop.name,
    indicator: stop.ring && !unchanged,
    ...(stop.ring && unchanged ? { unchanged: stop.look } : {}),
    inViewport: stop.inViewport,
    ...(stop.coveredBy ? { coveredBy: stop.coveredBy } : {}),
  };
};

/**
 * Tabs through a page from its start.
 * @param page - A loaded page; focus starts at the document.
 * @param maxStops - The most Tab presses.
 * @returns Every stop, whether the walk went all the way round, and where focus got stuck.
 */
export async function walkFocus(page: Page, maxStops = 60): Promise<FocusWalk> {
  await page.evaluate(() => void delete (window as unknown as { __hvlFocusWalk?: unknown }).__hvlFocusWalk);
  const reached: Reached[] = [];
  const stops: FocusStop[] = [];
  let repeats = 0;
  const settle = (rest: string | undefined) => {
    const last = reached.at(-1);
    if (last && stops.length < reached.length) stops.push(judged(last, rest));
  };
  for (let i = 0; i <= maxStops; i += 1) {
    await page.keyboard.press('Tab');
    const { stop, previousRest } = await page.evaluate(inspectFocus);
    if (stop?.seenAt === reached.length - 1 && stop.seenAt >= 0) {
      repeats += 1;
      if (repeats >= 2)
        return { stops: [...stops, judged(stop, undefined)], complete: false, trapped: stop.name };
      continue;
    }
    repeats = 0;
    settle(previousRest);
    if (!stop || stop.seenAt === 0) return { stops, complete: true };
    if (stop.seenAt > 0) return { stops, complete: false, trapped: `${stop.name} (a cycle)` };
    if (i === maxStops) break;
    reached.push(stop);
  }
  return { stops, complete: false };
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
