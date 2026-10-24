/**
 * Structural tests of the HVL H5P theme: every !important is explained, no colour literal appears, every token it
 * uses exists, and the rules for typography, focus, targets (with CoursePresentation's bar and footer), motion and
 * forced colours are present.
 *
 * Spec: UD-001, UD-002, UD-004, UD-005, UD-009, UD-011, UD-012
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SOURCES = {
  'src/hvl-h5p-theme.css': read('../src/hvl-h5p-theme.css'),
  'src/hvl-h5p-targets.css': read('../src/hvl-h5p-targets.css'),
  'src/hvl-h5p-feedback.css': read('../src/hvl-h5p-feedback.css'),
  'src/hvl-h5p-indicators.css': read('../src/hvl-h5p-indicators.css'),
  'dist/hvl-feedback-prefixes.css': read('../dist/hvl-feedback-prefixes.css'),
};
const THEME = SOURCES['src/hvl-h5p-theme.css'];
const TOKENS_CSS = read('../../design-tokens/dist/tokens.css');
const STYLELINT_CONFIG = fileURLToPath(new URL('../../../stylelint.config.mjs', import.meta.url));

/** Innermost rules as [prelude, body], where the prelude includes the comments written before the selector. */
const rules = (css: string): [string, string][] =>
  [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((m) => [m[1] ?? '', m[2] ?? '']);

/** Custom properties a stylesheet defines. */
const defined = (css: string) => new Set([...css.matchAll(/(--hvl-[\w-]+)\s*:/g)].map((m) => m[1]));

describe('the theme stylesheets', () => {
  it.each(Object.entries(SOURCES))(
    '[UD-011] every !important in %s names the H5P selector it beats',
    (_file, css) => {
      const unexplained = rules(css)
        .filter(([, body]) => body.includes('!important'))
        .filter(([prelude]) => !/\/\*\s*WHY:[^*]*`[^`]*[.:][\w-]+[^`]*`[\s\S]*?\*\//.test(prelude))
        .map(([prelude]) => prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim());
      expect(unexplained).toEqual([]);
    },
  );

  it.each(Object.entries(SOURCES))('[UD-001] %s passes the colour and typography lint', async (file, css) => {
    const path = fileURLToPath(new URL(`../${file}`, import.meta.url));
    const { results } = await stylelint.lint({ code: css, codeFilename: path, configFile: STYLELINT_CONFIG });
    expect(results[0]?.warnings.map((w) => w.text)).toEqual([]);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i);
  });

  it('[UD-001] every --hvl-* the theme and the prefix script use is defined by the tokens or the prefix sheet', () => {
    const known = new Set([...defined(TOKENS_CSS), ...defined(SOURCES['dist/hvl-feedback-prefixes.css'])]);
    const script = read('../src/feedbackPrefixes.js');
    const used = [
      ...Object.values(SOURCES).flatMap((css) => [...css.matchAll(/var\((--hvl-[\w-]+)/g)].map((m) => m[1])),
      ...[...script.matchAll(/'--hvl-feedback-' \+ state \+ '(-[\w-]+)'/g)].flatMap((m) =>
        ['correct', 'incorrect'].map((state) => `--hvl-feedback-${state}${m[1]}`),
      ),
    ];
    expect(used.length).toBeGreaterThan(20);
    expect([...new Set(used)].filter((name) => !known.has(name))).toEqual([]);
  });

  it('[UD-002] sets the HVL typeface and line height, removes ALL CAPS and justified text inside H5P', () => {
    expect(THEME).toMatch(/html\.h5p-iframe,[\s\S]*?font-family: var\(--hvl-font-ui\);/);
    expect(THEME).toContain('line-height: var(--hvl-line-height-h5p);');
    expect(THEME).toContain('text-transform: none !important;');
    expect(THEME).toContain('text-align: left !important;');
  });

  it('[UD-004] draws the two-tone focus ring from the focus tokens on :focus-visible', () => {
    const focus = rules(THEME).find(([prelude]) => prelude.trim().endsWith(':focus-visible'))?.[1] ?? '';
    expect(focus).toContain('outline: var(--hvl-focus-outline) !important;');
    expect(focus).toContain('outline-offset: var(--hvl-focus-offset) !important;');
    expect(focus).toContain('box-shadow: var(--hvl-focus-shadow) !important;');
  });

  it('[UD-005] gives every control a 24 × 24 px minimum', () => {
    expect(THEME).toMatch(
      /\[role='button'\][\s\S]*?min-width: var\(--hvl-target-min\);\s*min-height: var\(--hvl-target-min\);/,
    );
  });

  it('[UD-005] gives CoursePresentation’s bar and footer 24 px outside full screen, and the player room for both', () => {
    const targets = rules(SOURCES['src/hvl-h5p-targets.css']);
    const body = (selector: string) =>
      targets.find(([prelude]) => prelude.trim().endsWith(selector))?.[1] ?? '';
    expect(body(".h5p-course-presentation:not([class*='fullscreen']) .h5p-footer")).toContain(
      'min-height: var(--hvl-target-min);',
    );
    expect(body(".h5p-wrapper:not([class*='active-surface'])")).toMatch(/1\.6875%\)[\s\S]*3\.9375%\)/);
    expect(body(".h5p-course-presentation[class*='fullscreen'] .h5p-footer")).toContain('z-index: 2;');
  });

  it('[UD-009] stops animations and transitions under prefers-reduced-motion', () => {
    const motion = THEME.slice(THEME.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(motion).toContain('animation-duration: 0.01ms !important;');
    expect(motion).toContain('transition-duration: 0.01ms !important;');
  });

  it('[UD-012] keeps the focus ring visible in forced colours, where the inner ring is dropped', () => {
    expect(THEME).toMatch(
      /@media \(forced-colors: active\) \{[\s\S]*?:focus-visible \{[\s\S]*?outline-width:/,
    );
    expect(TOKENS_CSS).toMatch(/@media \(forced-colors: active\)[\s\S]*--hvl-focus-outer: Highlight;/);
  });

  it('[UD-012] gives every light-on-dark BranchingScenario button the painted text fill in forced colours', () => {
    // Start and end screen, back and navigation (proceed, replay) buttons share one style in BranchingScenario 1.10.
    const forced = THEME.slice(THEME.indexOf('@media (forced-colors: active)'));
    const rule =
      rules(forced).find(([, body]) => body.includes('-webkit-text-fill-color: ButtonText'))?.[0] ?? '';
    for (const button of ['.h5p-start-button', '.h5p-end-button', '.h5p-back-button', '.h5p-nav-button'])
      expect(rule).toContain(button);
  });
});
