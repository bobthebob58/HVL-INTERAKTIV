/**
 * contrast — WCAG 2.x relative luminance and contrast ratio of two sRGB colours.
 *
 * Why: UD-001 asks that every foreground/background pairing is recomputed on every build, so a changed brand value
 *      (HVL must still confirm them, Q2) cannot slip below WCAG 1.4.3 or 1.4.11 unnoticed. The formula is the one
 *      in WCAG 2.2 ("relative luminance"), the same as docs/reference/tools/contrast.py.
 * Spec: UD-001
 * Invariants:
 *   - Accepts only `#RRGGBB` (case-insensitive); anything else throws, so a typo in tokens.json fails loudly.
 *   - Ratios are not rounded; callers round for display.
 * Collaborators: ./tokenModel.mjs (resolves token names to values), ../test/contrast.test.ts.
 * Tests: packages/design-tokens/test/contrast.test.ts
 */

/** Minimum ratios by use (WCAG 1.4.3 text, 1.4.3 large text, 1.4.11 non-text UI). */
export const MINIMUM_RATIO = Object.freeze({ text: 4.5, 'large-text': 3, 'non-text': 3 });

/**
 * Linearises one 8-bit sRGB channel.
 * @param {number} channel - 0…255.
 * @returns {number} Linear value 0…1.
 */
function linear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance of a colour (WCAG 2.x).
 * @param {string} hex - `#RRGGBB`.
 * @returns {number} 0 (black) … 1 (white).
 * @throws {Error} When `hex` is not `#RRGGBB`.
 */
export function relativeLuminance(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((pair) => linear(Number.parseInt(pair, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, in either order.
 * @param {string} a - `#RRGGBB`.
 * @param {string} b - `#RRGGBB`.
 * @returns {number} 1 … 21.
 */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
