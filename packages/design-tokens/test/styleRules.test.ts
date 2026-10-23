/**
 * Proves the colour and typography lint rules: Stylelint (stylelint.config.mjs) and ESLint (eslint.config.mjs,
 * `COLOUR_BANS`) refuse colour literals, ALL CAPS, justified text and px font sizes outside the tokens package, and
 * accept token references.
 *
 * Spec: UD-001, UD-002
 */
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STYLELINT_CONFIG = fileURLToPath(new URL('../../../stylelint.config.mjs', import.meta.url));

/** The Stylelint rules a piece of CSS breaks, as if it were the file at `path`. */
async function cssRulesBroken(code: string, path: string): Promise<string[]> {
  const { results } = await stylelint.lint({
    code,
    codeFilename: `${ROOT}${path}`,
    configFile: STYLELINT_CONFIG,
  });
  return (results[0]?.warnings ?? []).map((w) => w.rule);
}

describe('the Stylelint rules', () => {
  it.each([
    ['a hex colour', 'a { color: #004357; }', 'color-no-hex'],
    ['rgb()', 'a { color: rgb(0 67 87); }', 'function-disallowed-list'],
    ['hsl()', 'a { background: hsl(193 100% 17%); }', 'function-disallowed-list'],
    ['color-mix()', 'a { color: color-mix(in srgb, var(--hvl-ink), white); }', 'function-disallowed-list'],
    ['a named colour', 'a { color: teal; }', 'color-named'],
    [
      'text-transform: uppercase',
      'h2 { text-transform: uppercase; }',
      'declaration-property-value-disallowed-list',
    ],
    ['text-align: justify', 'p { text-align: justify; }', 'declaration-property-value-disallowed-list'],
    ['a px font size', 'p { font-size: 14px; }', 'declaration-property-unit-allowed-list'],
    [
      'a px size in the font shorthand',
      'p { font: 14px/1.5 Arial; }',
      'declaration-property-unit-allowed-list',
    ],
  ])('[UD-001] refuses %s in application CSS', async (_label, code, rule) => {
    expect(await cssRulesBroken(code, 'apps/web/src/app/fixture.css')).toContain(rule);
    expect(await cssRulesBroken(code, 'packages/hvl-h5p-theme/src/fixture.css')).toContain(rule);
  });

  it('[UD-001] accepts token references, rem and em sizes and lower-case styling', async () => {
    const code = [
      'a { color: var(--hvl-primary-dark); background: var(--hvl-surface); }',
      'p { font-size: 1rem; line-height: var(--hvl-line-height-body); text-align: left; }',
      'small { font-size: 0.875em; text-transform: none; }',
      ':focus-visible { outline: var(--hvl-focus-outline); box-shadow: var(--hvl-focus-shadow); }',
    ].join('\n');
    expect(await cssRulesBroken(code, 'apps/web/src/app/fixture.css')).toEqual([]);
  });

  it('[UD-001] allows colour values in the tokens package only', async () => {
    const code =
      ':root { --hvl-ink: #111111; }\n@media (forced-colors: active) { :root { --x: CanvasText; } }';
    expect(await cssRulesBroken(code, 'packages/design-tokens/dist/tokens.css')).toEqual([]);
    expect(await cssRulesBroken(code, 'apps/web/src/app/fixture.css')).toContain('color-no-hex');
  });

  it('[UD-002] the typography rules also hold inside the tokens package', async () => {
    const code = 'p { text-transform: uppercase; font-size: 12px; }';
    expect((await cssRulesBroken(code, 'packages/design-tokens/dist/tokens.css')).sort()).toEqual([
      'declaration-property-unit-allowed-list',
      'declaration-property-value-disallowed-list',
    ]);
  });
});

describe('the ESLint colour rules', () => {
  let eslint: ESLint;
  beforeAll(() => {
    eslint = new ESLint({ cwd: ROOT });
  });

  /** The messages of ESLint's no-restricted-syntax rule for code linted as if it were at `path`. */
  async function colourMessages(code: string, path: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath: `${ROOT}${path}` });
    return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
  }

  it.each([
    [
      'a hex string in a .ts file',
      "export const brand = '#004357';\n",
      'apps/web/src/lib/fixture.ts',
      /UD-001/,
    ],
    ['an rgb() template', 'export const c = `rgb(${1} 2 3)`;\n', 'apps/web/src/lib/fixture.ts', /UD-001/],
    [
      'a hex string on the server',
      "export const c = 'border: 1px solid #fff';\n",
      'apps/server/src/fixture.ts',
      /UD-001/,
    ],
    [
      'a hex string in the theme script',
      "var c = '#00AFBA';\n",
      'packages/hvl-h5p-theme/src/fixture.js',
      /UD-001/,
    ],
    [
      'a hex colour in an SVG attribute of a markup template',
      'export const icon = `<svg><path fill="#004357" d="M0 0"/></svg>`;\n',
      'apps/server/src/http/pages/fixture.ts',
      /UD-001/,
    ],
    [
      'a hex colour in a single-quoted attribute string',
      "var html = \"<span style='color:x' data-c='#C9D5DA'>\";\n",
      'apps/server/src/lti/pages/client/fixture.js',
      /UD-001/,
    ],
    [
      'a color-mix() value',
      "export const c = 'color-mix(in srgb, var(--hvl-ink) 80%, transparent)';\n",
      'apps/web/src/components/fixture.ts',
      /UD-001/,
    ],
    [
      'a color() value',
      "var c = 'color(display-p3 0 0.3 0.4)';\n",
      'packages/hvl-h5p-theme/src/fixture.js',
      /UD-001/,
    ],
    [
      'a JSX style attribute',
      'export function Box() {\n  return <div style={{ color: "var(--hvl-ink)" }} />;\n}\n',
      'apps/web/src/components/Fixture.tsx',
      /D-072/,
    ],
  ])('[UD-001] refuses %s', async (_label, code, path, message) => {
    const messages = await colourMessages(code, path);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join('\n')).toMatch(message);
  });

  it('[UD-001] accepts a token reference and a token class', async () => {
    const ts = "export const ring = 'var(--hvl-focus-outer)';\nexport const id = '#main';\n";
    const tsx = 'export function Box() {\n  return <div className="bg-hvl-surface text-hvl-ink" />;\n}\n';
    expect(await colourMessages(ts, 'apps/web/src/lib/fixture.ts')).toEqual([]);
    expect(await colourMessages(tsx, 'apps/web/src/components/Fixture.tsx')).toEqual([]);
  });
});
