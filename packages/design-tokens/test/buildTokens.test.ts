/**
 * Tests for the token generator: deterministic output, committed files in step with tokens.json, `--check` drift
 * detection, refusal of malformed tokens, forced colours and the complete H5P Daylight mapping.
 *
 * Spec: UD-001, UD-011, UD-012
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIST_DIR, main, staleFiles } from '../scripts/buildTokens.mjs';
import { generateAll, OUTPUT_FILES } from '../scripts/tokenCss.mjs';
import { cssProperties, readTokens } from '../scripts/tokenModel.mjs';

const DAYLIGHT_VARIABLES = fileURLToPath(
  new URL('../../../apps/server/h5p/core/styles/h5p-theme-variables.css', import.meta.url),
);

const temporaryDirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'hvl-tokens-'));
  temporaryDirs.push(dir);
  return dir;
};
const tokensWith = (change: (tokens: Record<string, Record<string, unknown>>) => void) => {
  const tokens = readTokens() as Record<string, Record<string, unknown>>;
  change(tokens);
  const file = join(tempDir(), 'tokens.json');
  writeFileSync(file, JSON.stringify(tokens));
  return file;
};

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('the token generator', () => {
  it('[UD-001] writes the same bytes every time', () => {
    expect(generateAll(readTokens())).toEqual(generateAll(readTokens()));
    expect(Object.keys(generateAll(readTokens()))).toEqual([...OUTPUT_FILES]);
  });

  it('[UD-001] the committed dist files match tokens.json', () => {
    expect(staleFiles(generateAll(readTokens()), DIST_DIR)).toEqual([]);
  });

  it('[UD-001] --check fails on a changed or missing file and passes on fresh output', () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fresh = tempDir();
    const drifted = tempDir();
    const partial = tempDir();
    cpSync(DIST_DIR, fresh, { recursive: true });
    cpSync(DIST_DIR, drifted, { recursive: true });
    writeFileSync(
      join(drifted, 'tokens.css'),
      `${readFileSync(join(drifted, 'tokens.css'), 'utf8')}/* edit */\n`,
    );
    expect(main([`--out=${partial}`])).toBe(0);
    rmSync(join(partial, 'tailwind-theme.css'));
    // Act
    const results = [fresh, drifted, partial].map((dir) => main(['--check', `--out=${dir}`]));
    // Assert
    expect(results).toEqual([0, 1, 1]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('tokens.css is out of date'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('tailwind-theme.css is out of date'));
  });

  it('[UD-001] --check writes nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const empty = tempDir();
    expect(main(['--check', `--out=${empty}`])).toBe(1);
    expect(OUTPUT_FILES.filter((name) => existsSync(join(empty, name)))).toEqual([]);
  });

  it.each([
    [
      'an unknown colour ref',
      (t: Record<string, Record<string, unknown>>) => (t.color!.x = { ref: 'nope', use: 'x' }),
    ],
    [
      'a short hex value',
      (t: Record<string, Record<string, unknown>>) => (t.color!.x = { value: '#FFF', use: 'x' }),
    ],
    [
      'a token without a use',
      (t: Record<string, Record<string, unknown>>) => (t.color!.x = { value: '#FFFFFF' }),
    ],
    [
      'a non-system forced colour',
      (t: Record<string, Record<string, unknown>>) => (t.forcedColors!.ink = 'black'),
    ],
    [
      'an unknown Daylight target',
      (t: Record<string, Record<string, unknown>>) => (t.h5pDaylight!['--h5p-theme-ui-base'] = 'nope'),
    ],
    [
      'an unknown var() inside a value',
      (t: Record<string, Record<string, unknown>>) =>
        (t.focus!.outline = { value: 'var(--hvl-nope)', use: 'x' }),
    ],
  ])('[UD-001] refuses tokens.json with %s and writes nothing', (_label, change) => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const out = tempDir();
    // Act
    const code = main([`--tokens=${tokensWith(change)}`, `--out=${out}`]);
    // Assert
    expect(code).toBe(1);
    expect(OUTPUT_FILES.filter((name) => existsSync(join(out, name)))).toEqual([]);
  });

  it('[UD-001] a circular colour ref is refused', () => {
    const tokens = readTokens() as { color: Record<string, unknown> };
    tokens.color.a = { ref: 'b', use: 'x' };
    tokens.color.b = { ref: 'a', use: 'x' };
    expect(() => cssProperties(tokens)).toThrow(/circular/);
  });
});

describe('the documentation', () => {
  it('[UD-001] the README names every token', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const missing = cssProperties(readTokens())
      .map((p) => p.name)
      .filter((name) => !name.startsWith('--hvl-space-') && !readme.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });
});

describe('the generated CSS', () => {
  const css = generateAll(readTokens());

  it('[UD-012] forced colours switch the focus ring and feedback borders to system colours', () => {
    const forced = css['tokens.css']!.split('@media (forced-colors: active)')[1] ?? '';
    expect(forced).toContain('--hvl-focus-outer: Highlight;');
    expect(forced).toContain('--hvl-feedback-correct-border: CanvasText;');
    expect(forced).toContain('--hvl-feedback-incorrect-border: CanvasText;');
  });

  it('[UD-004] the focus ring is a 3 px outer ring with a 2 px inner ring at a 2 px offset', () => {
    expect(css['tokens.css']).toContain(
      '--hvl-focus-outline: var(--hvl-focus-outline-width) solid var(--hvl-focus-outer);',
    );
    expect(css['tokens.css']).toMatch(/--hvl-focus-outline-width: 3px;[\s\S]*--hvl-focus-offset: 2px;/);
    expect(css['tokens.css']).toContain(
      '--hvl-focus-shadow: 0 0 0 var(--hvl-focus-inner-width) var(--hvl-focus-inner);',
    );
  });

  it('[UD-011] every Daylight colour and font variable of H5P Core 1.28 is pointed at a token', () => {
    // Arrange
    if (!existsSync(DAYLIGHT_VARIABLES)) {
      if (process.env.CI) throw new Error(`${DAYLIGHT_VARIABLES} is missing; run npm run h5p:fetch-core`);
      return;
    }
    const core = readFileSync(DAYLIGHT_VARIABLES, 'utf8');
    const themed = [...core.matchAll(/(--h5p-theme-[\w-]+):\s*(#[0-9A-Fa-f]{3,8}|color-mix\(|"Inter")/g)].map(
      (m) => m[1],
    );
    // Act
    const mapped = new Set(css['h5p-daylight.css']!.match(/--h5p-theme-[\w-]+(?=:)/g));
    // Assert
    expect(themed.length).toBeGreaterThan(30);
    expect(themed.filter((name) => !mapped.has(name!))).toEqual([]);
  });
});
