/**
 * tokenCss — writes the text of the generated CSS files from tokens.json: custom properties, the Tailwind v4 theme
 * and the H5P Daylight mapping.
 *
 * Why: the web app (Tailwind v4, which configures themes in CSS, D-072) and the H5P theme (Core 1.28's Daylight
 *      custom properties, UD-011) must use the same values, so both are generated from one file. Forced colours get
 *      system colours for focus rings and feedback borders (UD-012).
 * Spec: UD-001, UD-002, UD-004, UD-011, UD-012
 * Invariants:
 *   - Pure and deterministic: the same tokens give byte-identical output (no dates, no environment).
 *   - The Tailwind theme removes Tailwind's own colours and fonts (`--color-*: initial`, `--font-*: initial`), so
 *     only `hvl-*` colour classes exist.
 *   - Strings use single quotes and hex colours lower case, as Prettier writes them, so formatting changes nothing.
 * SPEC-DEVIATION: D-072 — UD-001 asks for a Tailwind preset; Tailwind v4 themes are CSS, so it is tailwind-theme.css.
 * Collaborators: ./tokenModel.mjs, ./buildTokens.mjs.
 * Tests: packages/design-tokens/test/buildTokens.test.ts, packages/design-tokens/test/tailwindTheme.test.ts
 */
import { cssProperties } from './tokenModel.mjs';

/** The generated files, by name under dist/. */
export const OUTPUT_FILES = Object.freeze(['tokens.css', 'tailwind-theme.css', 'h5p-daylight.css']);

const header = (name, what) =>
  [
    '/*',
    ` * ${name} — GENERATED from packages/design-tokens/tokens.json by scripts/buildTokens.mjs. Do not edit.`,
    ` * ${what}`,
    ' * Rebuild with `npm run tokens:build`; `npm run tokens:check` fails when this file is out of date (D-072).',
    ' */',
  ].join('\n');

// WHY: Prettier rewrites CSS this way; matching it keeps lint-staged from changing a committed generated file.
const prettierStyle = (value) =>
  value.replaceAll('"', "'").replace(/#[0-9A-Fa-f]{6}\b/g, (hex) => hex.toLowerCase());
const block = (selector, lines, indent = '') =>
  [`${indent}${selector} {`, ...lines.map((l) => `${indent}  ${l}`), `${indent}}`].join('\n');

/**
 * The custom properties on `:root`, plus their forced-colours overrides.
 * @param {object} tokens - Parsed tokens.json.
 * @returns {string} The text of dist/tokens.css.
 */
export function tokensCss(tokens) {
  const declarations = cssProperties(tokens).map((p) => `${p.name}: ${prettierStyle(p.value)};`);
  const forced = Object.entries(tokens.forcedColors ?? {}).map(([name, value]) => `--hvl-${name}: ${value};`);
  return [
    header(
      'tokens',
      'Every HVL token as a custom property on :root (UD-001), with system colours in forced colours (UD-012).',
    ),
    '',
    block(':root', declarations),
    '',
    '@media (forced-colors: active) {',
    block(':root', forced, '  '),
    '}',
    '',
  ].join('\n');
}

/**
 * The Tailwind v4 theme: Tailwind's palette and fonts removed, `hvl-*` aliases to the custom properties.
 * @param {object} tokens - Parsed tokens.json.
 * @returns {string} The text of dist/tailwind-theme.css.
 */
export function tailwindThemeCss(tokens) {
  const colours = Object.keys(tokens.color).map((name) => `--color-hvl-${name}: var(--hvl-${name});`);
  const fonts = Object.keys(tokens.font).map((name) => `--font-${name}: var(--hvl-font-${name});`);
  return [
    header(
      'tailwind-theme',
      "Tailwind v4 theme: `@import '@hvl-interaktiv/design-tokens/tailwind-theme.css';` after `@import 'tailwindcss';`.",
    ),
    "@import './tokens.css';",
    '',
    block('@theme', ['--color-*: initial;', '--font-*: initial;']),
    '',
    block('@theme inline', [
      ...colours,
      ...fonts,
      '--font-sans: var(--hvl-font-ui);',
      '--font-serif: var(--hvl-font-body);',
      '--leading-body: var(--hvl-line-height-body);',
      '--spacing-target: var(--hvl-target-min);',
      '--container-measure: var(--hvl-measure);',
    ]),
    '',
  ].join('\n');
}

/**
 * H5P Core 1.28's Daylight custom properties, pointed at the tokens.
 * @param {object} tokens - Parsed tokens.json.
 * @returns {string} The text of dist/h5p-daylight.css.
 */
export function h5pDaylightCss(tokens) {
  cssProperties(tokens);
  const declarations = Object.entries(tokens.h5pDaylight).map(
    ([name, token]) => `${name}: var(--hvl-${token});`,
  );
  return [
    header('h5p-daylight', "H5P Core 1.28's Daylight theme variables mapped onto the HVL tokens (UD-011)."),
    '',
    block(':root', declarations),
    '',
  ].join('\n');
}

/**
 * Every generated file.
 * @param {object} tokens - Parsed tokens.json.
 * @returns {Record<string, string>} File name under dist/ → text.
 */
export function generateAll(tokens) {
  return {
    'tokens.css': tokensCss(tokens),
    'tailwind-theme.css': tailwindThemeCss(tokens),
    'h5p-daylight.css': h5pDaylightCss(tokens),
  };
}
