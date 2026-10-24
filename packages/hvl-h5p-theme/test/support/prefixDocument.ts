/**
 * prefixDocument — opens a simulated document (jsdom) with the generated prefix stylesheet and the theme's
 * stylesheet for labels, and runs src/feedbackPrefixes.js in it, for the script's tests.
 *
 * Why: the prefix script reads its targets and labels from the stylesheet's custom properties (UD-003, UD-010), so
 *      every test needs the same document set-up; one helper keeps the tests about behaviour, not plumbing.
 * Spec: UD-003, UD-010
 * Invariants: scripts run only through `window.eval` of the theme's own file (`runScripts: 'outside-only'`).
 * Collaborators: ../../src/feedbackPrefixes.js, ../../scripts/buildFeedbackPrefixes.mjs.
 * Tests: packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts, packages/hvl-h5p-theme/test/feedbackNames.test.ts
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { prefixCss, readInputs } from '../../scripts/buildFeedbackPrefixes.mjs';

/** The prefix script's source. */
export const SCRIPT = readFileSync(new URL('../../src/feedbackPrefixes.js', import.meta.url), 'utf8');
const PREFIX_CSS = prefixCss(readInputs());

/**
 * Opens a document and runs the prefix script.
 * @param options - `lang` of `<html>`, the `body` markup, and whether the prefix stylesheet is present.
 * @returns The window, its document, `settle()` (waits for the script's observer) and `labels()`: each label as
 *   [id of the nearest element with an id, state, class, text].
 */
export function openPrefixDocument(options: { lang: string; body: string; withStylesheet?: boolean }) {
  const style = options.withStylesheet === false ? '' : `<style>${PREFIX_CSS}</style>`;
  const dom = new JSDOM(
    `<!doctype html><html lang="${options.lang}"><head>${style}</head><body>${options.body}</body></html>`,
    { runScripts: 'outside-only', virtualConsole: new VirtualConsole() },
  );
  dom.window.eval(SCRIPT);
  const document = dom.window.document;
  const settle = () => new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  const labels = () =>
    [...document.querySelectorAll('.hvl-feedback-sr, .hvl-feedback-text')].map((n) => [
      n.parentElement?.closest('[id]')?.id,
      n.getAttribute('data-hvl-feedback'),
      n.className,
      n.textContent,
    ]);
  return { window: dom.window, document, settle, labels };
}
