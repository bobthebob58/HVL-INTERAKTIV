/**
 * inlineSpans — makes jsdom report a `<span>` as `display: inline`, as a browser's default stylesheet does, so an
 * accessible name that holds a `<span lang>` is computed without spaces around it.
 *
 * Why: jsdom has no default stylesheet and reports `display` as '' for every element; dom-accessibility-api then
 *      treats a span as a block and puts a space on each side of it. A caption «Svara på «<span>Q</span>»» would be
 *      named «Svara på « Q »» in the tests while every browser names it «Svara på «Q»» (UD-010 marks the quoted part).
 * Spec: UD-010
 * Collaborators: vitest `vi.spyOn`; restored after each test by ./cleanup.ts.
 * Tests: used by apps/web/test/features/insight/InsightLanguage.test.tsx and InsightQuotedLanguage.test.tsx.
 */
import { vi } from 'vitest';

/** Lets `window.getComputedStyle` report a span without a display as inline, until the test's mocks are restored. */
export function treatSpansAsInline(): void {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = original(element, pseudo);
    // WHY: only what the HTML default stylesheet says (span is inline); a display a test set itself is kept.
    if (element.tagName === 'SPAN' && style.getPropertyValue('display') === '')
      style.setProperty('display', 'inline');
    return style;
  });
}
