/**
 * buildFeedbackPrefixes — writes dist/hvl-feedback-prefixes.css from the theme's locale files and target list, or
 * with `--check` fails when the committed file differs from what it would write.
 *
 * Why: UD-003 requires an icon and a text prefix on every correct or incorrect answer ("✓ Riktig:" / "✗ Feil:" in
 *      nn and nb, "✓ Correct:" / "✗ Incorrect:" in en). The texts are i18n keys (src/locales, key parity checked by
 *      doc-lint), so the stylesheet is generated from them: `:lang()` rules pick the text by the language of the
 *      element, which is the content language inside H5P's documents (UD-010). The same file carries the target
 *      selectors and the plain labels for ./src/feedbackPrefixes.js, so the visible and the announced prefix
 *      cannot drift apart.
 * Spec: UD-003, UD-010
 * Invariants:
 *   - Deterministic; `nn` is the default (`:root`, D-009), `nb` also answers to `no`, then `en`.
 *   - A prefix must start with its icon (✓ correct, ✗ incorrect) followed by a space; the label is the rest.
 *   - The visible prefix has empty alternative text (`content: … / ''`), so screen readers read only the hidden
 *     label the script adds, never the icon or the prefix twice.
 *   - Selectors and texts contain no quote or backslash, so they are safe inside CSS strings.
 *   - Where a library draws its own ✓/✗ icon (`ownIcon`), the visible prefix is the label alone; otherwise it
 *     is icon and label. Either way the state shows an icon and a text (UD-003).
 *   - Targets with `prefixOn: "label"` get no pseudo-element; they are listed in `--hvl-feedback-*-shown`, and the
 *     script shows their label as text, which is then both the visible and the announced prefix. Every other
 *     visible prefix is a `::before`, or an `::after` where the entry names `prefixPseudo: "after"`.
 * Collaborators: ./feedbackTargetList.mjs, ../src/locales/*.json, ../src/feedbackTargets.json,
 *   ../src/feedbackPrefixes.js.
 * Tests: packages/hvl-h5p-theme/test/feedbackPrefixesCss.test.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  prefixSelectors,
  STATES,
  stateTargets,
  targetEntries,
  UNSAFE_IN_CSS_STRING,
} from './feedbackTargetList.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('../', import.meta.url));
/** The generated file. */
export const OUTPUT_FILE = join(PACKAGE_DIR, 'dist', 'hvl-feedback-prefixes.css');
/** Locales in output order; the first is the default. `nb` also covers the generic `no`. */
export const LOCALE_SELECTORS = Object.freeze({
  nn: ':root,\n:lang(nn)',
  nb: ':lang(nb),\n:lang(no)',
  en: ':lang(en)',
});
const ICONS = Object.freeze({ correct: '✓', incorrect: '✗' });

/**
 * Reads the inputs of the stylesheet.
 * @param {string} [dir] - The package directory (tests pass a copy).
 * @returns {{locales: Record<string, {feedback: Record<string, string>}>, targets: {targets: object[]}}}
 */
export function readInputs(dir = PACKAGE_DIR) {
  const json = (path) => JSON.parse(readFileSync(join(dir, path), 'utf8'));
  const locales = Object.fromEntries(
    Object.keys(LOCALE_SELECTORS).map((l) => [l, json(`src/locales/${l}.json`)]),
  );
  return { locales, targets: json('src/feedbackTargets.json') };
}

/**
 * Splits a prefix into its icon and its label.
 * @param {string} prefix - E.g. `✓ Riktig:`.
 * @param {'correct' | 'incorrect'} state - Which icon it must start with.
 * @returns {string} The label, e.g. `Riktig:`.
 * @throws {Error} When the icon is missing or the text is unsafe in a CSS string.
 */
export function labelOf(prefix, state) {
  const icon = `${ICONS[state]} `;
  if (typeof prefix !== 'string' || !prefix.startsWith(icon) || prefix.length <= icon.length) {
    throw new Error(`the ${state} prefix must start with "${icon}" and a label: ${prefix}`);
  }
  if (UNSAFE_IN_CSS_STRING.test(prefix))
    throw new Error(`a prefix may not contain quotes or backslashes: ${prefix}`);
  return prefix.slice(icon.length).trim();
}

const block = (selector, lines) => [`${selector} {`, ...lines.map((l) => `  ${l}`), '}'].join('\n');

/**
 * The text of dist/hvl-feedback-prefixes.css.
 * @param {ReturnType<typeof readInputs>} inputs - Locales and targets.
 * @returns {string} The stylesheet.
 * @throws {Error} When a locale lacks a prefix, a prefix lacks its icon or a selector is empty or unsafe.
 */
export function prefixCss({ locales, targets }) {
  const entries = targetEntries(targets);
  const languageBlocks = Object.entries(LOCALE_SELECTORS).map(([locale, selector]) => {
    const feedback = locales[locale]?.feedback ?? {};
    const lines = STATES.flatMap((state) => {
      const prefix = feedback[`${state}Prefix`];
      const label = labelOf(prefix, state);
      return [`--hvl-feedback-${state}-prefix: '${prefix}';`, `--hvl-feedback-${state}-label: '${label}';`];
    });
    return block(selector, lines);
  });
  const drawn = (state, ownIcon) => prefixSelectors(entries, state, ownIcon);
  // A11Y: the visible prefix has empty alternative text; the script's hidden label is what is announced (UD-003).
  const content = (state, ownIcon, part) =>
    drawn(state, ownIcon).length === 0
      ? []
      : [
          '',
          block(drawn(state, ownIcon).join(',\n'), [`content: var(--hvl-feedback-${state}-${part}) / '';`]),
        ];
  const list = (selectors) => `'${selectors.join(', ')}'`;
  return [
    '/*',
    ' * hvl-feedback-prefixes — GENERATED from src/locales/*.json and src/feedbackTargets.json by',
    ' * scripts/buildFeedbackPrefixes.mjs. Do not edit; run `npm run build --workspace packages/hvl-h5p-theme`.',
    ' * Visible prefixes for correct and incorrect answers (UD-003), in the language of the element (UD-010).',
    ' * Where the library draws its own ✓/✗ icon, the prefix is the label alone, so no icon appears twice.',
    ' * Where two entries match one element, the label rule comes later and wins over the icon-and-label rule.',
    ' * `--hvl-feedback-*-shown`: the targets whose label src/feedbackPrefixes.js shows as text (no pseudo-element).',
    ' */',
    '',
    block(':root', [
      ...STATES.map((s) => `--hvl-feedback-${s}-targets: ${list(stateTargets(entries, s))};`),
      ...STATES.map(
        (s) => `--hvl-feedback-${s}-shown: ${list(stateTargets(entries, s, { shownOnly: true }))};`,
      ),
    ]),
    '',
    languageBlocks.join('\n\n'),
    ...STATES.flatMap((state) => [...content(state, false, 'prefix'), ...content(state, true, 'label')]),
    '',
    block(STATES.flatMap((state) => [...drawn(state, false), ...drawn(state, true)]).join(',\n'), [
      'display: inline-block;',
      'margin-inline-end: 0.25em;',
      'font-weight: bold;',
      'text-indent: 0;',
      'white-space: nowrap;',
      'word-break: normal;',
    ]),
    '',
  ].join('\n');
}

/**
 * Runs the build or the check.
 * @param {string[]} args - Command-line arguments without `node` and the script path.
 * @returns {number} The exit code.
 */
export function main(args) {
  const option = (key) => args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const out = resolve(option('out') ?? OUTPUT_FILE);
  let css;
  try {
    css = prefixCss(readInputs(option('dir') ?? PACKAGE_DIR));
  } catch (error) {
    console.error(`✗ feedback prefixes: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (args.includes('--check')) {
    const current = existsSync(out) && readFileSync(out, 'utf8') === css;
    if (current) console.log('✓ feedback prefixes: up to date.');
    else console.error(`✗ ${out} is out of date; run npm run build --workspace packages/hvl-h5p-theme`);
    return current ? 0 : 1;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, css);
  console.log(`✓ feedback prefixes: wrote ${out}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
