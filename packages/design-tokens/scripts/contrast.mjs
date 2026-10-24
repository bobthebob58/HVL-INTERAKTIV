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
 *   - `srgbMix` reproduces `color-mix(in srgb, …)`, which a library may use to derive a shade from Daylight's
 *     variables (CoursePresentation 1.28's progress bar), so such a drawn colour can be checked too.
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
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The three 8-bit channels of a colour.
 * @param {string} hex - `#RRGGBB`.
 * @returns {number[]} Red, green, blue, 0…255.
 * @throws {Error} When `hex` is not `#RRGGBB`.
 */
function channels(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #RRGGBB colour: ${hex}`);
  return match.slice(1).map((pair) => Number.parseInt(pair, 16));
}

/**
 * Mixes two colours as `color-mix(in srgb, a <percentOfA>%, b)` does: per channel, in gamma-encoded sRGB.
 * @param {string} a - `#RRGGBB`.
 * @param {number} percentOfA - 0…100.
 * @param {string} b - `#RRGGBB`.
 * @returns {string} `#RRGGBB`, each channel rounded to the nearest integer as browsers paint it.
 * @throws {Error} When a colour is not `#RRGGBB` or the percentage lies outside 0…100.
 */
export function srgbMix(a, percentOfA, b) {
  if (!(percentOfA >= 0 && percentOfA <= 100)) throw new Error(`not a percentage: ${percentOfA}`);
  const [ca, cb] = [channels(a), channels(b)];
  const mixed = ca.map((channel, i) =>
    Math.round((channel * percentOfA + (cb[i] ?? 0) * (100 - percentOfA)) / 100),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
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
