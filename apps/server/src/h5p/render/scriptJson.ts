/**
 * scriptJson — JSON that is safe to place inside an HTML <script> element.
 *
 * Why: `JSON.stringify` leaves "<", ">" and "&" as they are, so a value containing "</script>" ends the script
 *      element and whatever follows runs as page script (Lumi's own templates have this flaw, D-040). U+2028 and
 *      U+2029 are valid in JSON but end lines in older JavaScript engines.
 * Spec: SEC-008
 * Invariants:
 *   - The output parses with `JSON.parse` to exactly the input value.
 *   - The output contains no "<", ">", "&", U+2028 or U+2029 characters.
 * Collaborators: ./playerPage.ts.
 * Tests: apps/server/test/h5p/render/playerPage.test.ts
 */

const UNSAFE: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/**
 * Serialises a value as JSON that can be embedded in a `<script>` element.
 * @param value - Any JSON-serialisable value.
 * @returns JSON text with markup-significant characters escaped.
 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => UNSAFE[char] ?? char);
}

/**
 * Escapes text for an HTML attribute value in double quotes or for element text.
 * @param text - Any text, e.g. a URL or an ID.
 * @returns The text with `& < > " '` as character references.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
