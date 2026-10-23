/**
 * stylelint.config — CSS rules that keep colours in the design tokens and HVL's typography rules in force.
 *
 * Why: UD-001 makes packages/design-tokens the only source of colour, and UD-002 forbids ALL-CAPS styling,
 *      justified text and font sizes outside rem/em (HVL's universal-design guidance, spec 03 §1). A rule in CI
 *      catches what review misses (D-072). ESLint applies the same colour ban to JavaScript (eslint.config.mjs).
 * Spec: UD-001, UD-002
 * Invariants:
 *   - Outside packages/design-tokens, no hex colour, no named colour and no colour function may appear.
 *   - `text-transform: uppercase` and `text-align: justify` fail everywhere, the tokens package included.
 *   - `font-size` and the `font` shorthand accept only rem and em (unitless keywords such as `inherit` pass).
 * Collaborators: .stylelintignore (vendored and generated CSS), packages/design-tokens/tokens.json.
 * Tests: packages/design-tokens/test/styleRules.test.ts; `npm run lint:css` in CI.
 */

/** Functions that produce a colour from literal channels; derived shades need HVL's approval (D-017). */
const COLOUR_FUNCTIONS = [
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  // WHY: color-mix() mixes tokens into new, untested shades; HVL has not approved derived shades (D-017).
  'color-mix',
];

/** @type {import('stylelint').Config} */
export default {
  rules: {
    'color-no-hex': [true, { message: 'UD-001: use a design token (var(--hvl-…)), not a hex colour.' }],
    'color-named': ['never', { message: 'UD-001: use a design token (var(--hvl-…)), not a named colour.' }],
    'function-disallowed-list': [
      COLOUR_FUNCTIONS,
      { message: (name) => `UD-001: use a design token (var(--hvl-…)), not ${name}().` },
    ],
    'declaration-property-value-disallowed-list': [
      {
        'text-transform': ['/uppercase/i'],
        'text-align': ['/justify/i'],
        'text-align-last': ['/justify/i'],
      },
      { message: 'UD-002: no ALL-CAPS styling and no justified text (HVL universal-design rules).' },
    ],
    'declaration-property-unit-allowed-list': [
      { 'font-size': ['rem', 'em'], '/^font$/': ['rem', 'em'] },
      { message: 'UD-002: font sizes are in rem or em, so text follows the reader’s settings (WCAG 1.4.4).' },
    ],
  },
  overrides: [
    {
      // WHY: the tokens package is where colour values are defined (UD-001, D-072): its JSON and generated CSS.
      files: ['packages/design-tokens/**/*.css'],
      rules: { 'color-no-hex': null, 'color-named': null, 'function-disallowed-list': null },
    },
  ],
};
