/**
 * repairDocument — opens a simulated document (jsdom) with markup copied from the real H5P libraries and runs one of
 * the theme's markup repair scripts in it, for the scripts' tests.
 *
 * Why: the content repairs (src/a11yRepairs.js) and the editor repairs (src/a11yEditorRepairs.js) are tested the
 *      same way (D-080, UD-030): one helper keeps the tests about what each repair writes, not about set-up.
 * Spec: UD-030
 * Invariants: scripts run only through `window.eval` of the theme's own file (`runScripts: 'outside-only'`).
 * Collaborators: ../../src/a11yRepairs.js, ../../src/a11yEditorRepairs.js.
 * Tests: packages/hvl-h5p-theme/test/a11yRepairs.test.ts, packages/hvl-h5p-theme/test/a11yEditorRepairs.test.ts,
 *   packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * Reads a repair script of the theme.
 * @param name - The file name in src/, e.g. `a11yRepairs.js`.
 * @returns The script's source.
 */
export const repairScript = (name: string): string =>
  readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');

/**
 * Opens a document with the markup and runs the script in it.
 * @param script - The script's source (`repairScript`).
 * @param body - The markup of `<body>`.
 * @returns The window and document, `settle()` (waits for the script's observer), `$` and `attr` lookups and
 *   `labelledBy`, the text an element's aria-labelledby list resolves to.
 */
export function openRepairDocument(script: string, body: string) {
  const dom = new JSDOM(`<!doctype html><html lang="nn"><body>${body}</body></html>`, {
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  dom.window.eval(script);
  const document = dom.window.document;
  const settle = () => new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  const $ = (selector: string) => document.querySelector(selector)!;
  const attr = (selector: string, name: string) => $(selector).getAttribute(name);
  const labelledBy = (selector: string) =>
    (attr(selector, 'aria-labelledby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .join(' ');
  return { window: dom.window, document, settle, $, attr, labelledBy };
}

/**
 * The script's code without comments, for checks of what it may not do.
 * @param script - The script's source.
 * @returns The code.
 */
export const codeOf = (script: string): string =>
  script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
