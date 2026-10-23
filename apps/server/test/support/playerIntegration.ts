/**
 * playerIntegration — reads what an H5P page hands to H5P Core: the JSON data block that becomes
 * `window.H5PIntegration`, and any script element that would run inline.
 *
 * Why: since D-070 the player and editor pages carry the integration object as an inert
 *      `<script type="application/json" id="h5p-integration">` block instead of an inline script. Tests read it in one
 *      way, so a change to the page format changes one helper.
 * Spec: DATA-011, H5P-009
 * Tests: shared by apps/server/test/http/*.int.test.ts and apps/server/test/lti/*.int.test.ts.
 */

const DATA_BLOCK = /<script type="application\/json" id="h5p-integration">(.*?)<\/script>/s;

/**
 * The raw JSON text of the page's integration block.
 * @param html - A rendered H5P page.
 * @returns The block's text, or '' when the page has none.
 */
export const integrationText = (html: string): string => DATA_BLOCK.exec(html)?.[1] ?? '';

/**
 * The integration object of a rendered H5P page.
 * @param html - A rendered H5P page.
 * @returns The parsed object, or null when the page has no block.
 */
export function integrationFromPage<T = Record<string, unknown>>(html: string): T | null {
  const text = integrationText(html);
  return text === '' ? null : (JSON.parse(text) as T);
}

/**
 * Script elements that would run inline: neither a `src` nor an inert JSON block.
 * @param html - A rendered page.
 * @returns Their opening tags (empty for a page that works under a strict `script-src`).
 */
export const inlineScriptTags = (html: string): string[] =>
  html.match(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>/g) ?? [];
