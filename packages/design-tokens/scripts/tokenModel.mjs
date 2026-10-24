/**
 * tokenModel — reads tokens.json, checks it, and turns it into the flat list of CSS custom properties.
 *
 * Why: tokens.json is the only place a colour value may be written (UD-001, D-072). Every generated file and the
 *      contrast test read it through this one model, so they cannot disagree about a name, an alias or a value.
 * Spec: UD-001, UD-002, UD-004, UD-005, UD-012
 * Invariants:
 *   - Every token becomes `--hvl-<group prefix><name>`; colours have no group prefix (`--hvl-ink`).
 *   - A colour is either `#RRGGBB` or a `ref` to another colour; refs become `var(--hvl-<ref>)` in CSS and resolve
 *     to the referenced hex for contrast checks. A missing or circular ref throws.
 *   - Every `var(--hvl-…)` inside a value, every forced-colours key, Daylight mapping and pairing names a token
 *     that exists; forced-colours values are CSS system colours. A pairing side may be a `color-mix` of two
 *     tokens, where an H5P library draws such a shade (`{ "mix": [token, percent, token] }`).
 * Collaborators: ./contrast.mjs, ./tokenCss.mjs, ./buildTokens.mjs, ../tokens.json, ../test/contrast.test.ts.
 * Tests: packages/design-tokens/test/contrast.test.ts, packages/design-tokens/test/buildTokens.test.ts
 */
import { readFileSync } from 'node:fs';
import { srgbMix } from './contrast.mjs';

/** Where tokens.json lives. */
export const TOKENS_FILE = new URL('../tokens.json', import.meta.url);

/** The CSS name prefix of each group in tokens.json. */
export const GROUP_PREFIX = Object.freeze({
  color: '',
  font: 'font-',
  lineHeight: 'line-height-',
  size: '',
  focus: 'focus-',
  space: 'space-',
});

/** CSS system colours allowed under `forcedColors` (CSS Color 4 §6.2, UD-012). */
export const SYSTEM_COLOURS = new Set([
  'AccentColor',
  'AccentColorText',
  'ButtonBorder',
  'ButtonFace',
  'ButtonText',
  'Canvas',
  'CanvasText',
  'Field',
  'FieldText',
  'GrayText',
  'Highlight',
  'HighlightText',
  'LinkText',
  'Mark',
  'MarkText',
  'SelectedItem',
  'SelectedItemText',
  'VisitedText',
]);

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Reads and parses tokens.json.
 * @param {URL | string} [file] - Another tokens file (tests pass fixtures).
 * @returns {object} The parsed tokens.
 */
export function readTokens(file = TOKENS_FILE) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Resolves a colour token to its hex value, following refs.
 * @param {object} tokens - Parsed tokens.json.
 * @param {string} name - Colour name, e.g. `focus-outer`.
 * @returns {string} `#RRGGBB`.
 * @throws {Error} For an unknown name, a circular ref or a value that is not `#RRGGBB`.
 */
export function colourHex(tokens, name) {
  const seen = new Set();
  let current = name;
  for (;;) {
    const token = tokens.color?.[current];
    if (!token) throw new Error(`unknown colour token: ${current}`);
    if (seen.has(current)) throw new Error(`circular colour ref at: ${current}`);
    seen.add(current);
    if (token.ref === undefined) {
      if (!HEX.test(token.value ?? '')) throw new Error(`colour ${current} is not #RRGGBB: ${token.value}`);
      return token.value;
    }
    current = token.ref;
  }
}

/**
 * Flattens tokens.json into CSS custom properties, in file order.
 * @param {object} tokens - Parsed tokens.json.
 * @returns {{name: string, value: string, use: string}[]} One entry per token, e.g. `--hvl-ink: #111111`.
 * @throws {Error} When a token is malformed or references something that does not exist.
 */
export function cssProperties(tokens) {
  const properties = [];
  for (const [group, prefix] of Object.entries(GROUP_PREFIX)) {
    for (const [name, token] of Object.entries(tokens[group] ?? {})) {
      if (group === 'color') colourHex(tokens, name);
      const value = token.ref === undefined ? token.value : `var(--hvl-${token.ref})`;
      if (typeof value !== 'string' || value === '') throw new Error(`token ${group}.${name} has no value`);
      if (!token.use) throw new Error(`token ${group}.${name} does not say what it is for (use)`);
      properties.push({ name: `--hvl-${prefix}${name}`, value, use: token.use });
    }
  }
  const names = new Set(properties.map((p) => p.name));
  if (names.size !== properties.length) throw new Error('two tokens produce the same CSS name');
  for (const { name, value } of properties) {
    for (const [, used] of value.matchAll(/var\((--hvl-[\w-]+)\)/g)) {
      if (!names.has(used)) throw new Error(`${name} uses unknown ${used}`);
    }
  }
  checkReferences(tokens, names);
  return properties;
}

/**
 * Checks the sections that refer to tokens by name.
 * @param {object} tokens - Parsed tokens.json.
 * @param {Set<string>} names - Every `--hvl-*` name.
 * @throws {Error} At the first unknown reference.
 */
function checkReferences(tokens, names) {
  for (const [name, value] of Object.entries(tokens.forcedColors ?? {})) {
    colourHex(tokens, name);
    if (!SYSTEM_COLOURS.has(value)) throw new Error(`forcedColors.${name} is not a system colour: ${value}`);
  }
  for (const [daylight, token] of Object.entries(tokens.h5pDaylight ?? {})) {
    if (!daylight.startsWith('--h5p-theme-')) throw new Error(`not a Daylight variable: ${daylight}`);
    if (!names.has(`--hvl-${token}`)) throw new Error(`${daylight} maps to unknown token ${token}`);
  }
  for (const pairing of tokens.pairings ?? []) {
    pairingHex(tokens, pairing.fg);
    pairingHex(tokens, pairing.bg);
  }
}

/**
 * The colour one side of a pairing names: a colour token, or `{ "mix": [token, percent, token] }` for a shade an
 * H5P library derives from Daylight's variables with `color-mix(in srgb, …)`.
 * @param {object} tokens - Parsed tokens.json.
 * @param {string | {mix: [string, number, string]}} side - The `fg` or `bg` of a pairing.
 * @returns {string} `#RRGGBB`.
 * @throws {Error} For an unknown token or a malformed mix.
 */
export function pairingHex(tokens, side) {
  if (typeof side === 'string') return colourHex(tokens, side);
  const [a, percent, b] = Array.isArray(side?.mix) ? side.mix : [];
  if (typeof a !== 'string' || typeof b !== 'string' || typeof percent !== 'number') {
    throw new Error(
      `a pairing colour is a token name or { mix: [token, percent, token] }: ${JSON.stringify(side)}`,
    );
  }
  return srgbMix(colourHex(tokens, a), percent, colourHex(tokens, b));
}

/**
 * The colour tokens one side of a pairing uses.
 * @param {string | {mix: [string, number, string]}} side - The `fg` or `bg` of a pairing.
 * @returns {string[]} Token names.
 */
export function pairingTokens(side) {
  return typeof side === 'string' ? [side] : [side.mix[0], side.mix[2]];
}
