/**
 * Tests for the generated prefix stylesheet: the three locales' prefixes, the `:lang()` selection, the empty
 * alternative text of the visible prefix, and drift detection of the committed file.
 *
 * Spec: UD-003, UD-010
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { labelOf, main, OUTPUT_FILE, prefixCss, readInputs } from '../scripts/buildFeedbackPrefixes.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('../', import.meta.url));
interface TargetEntry {
  library: string;
  correct: string;
  incorrect: string;
  prefixOn?: { correct: string; incorrect: string };
  ownIcon: boolean;
}

const css = prefixCss(readInputs());
const ENTRIES = (readInputs().targets as { targets: TargetEntry[] }).targets;
const STATES = ['correct', 'incorrect'] as const;
const temporaryDirs: string[] = [];

/** A copy of the package's inputs with one locale file changed. */
function packageCopyWith(locale: string, prefixes: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'hvl-prefixes-'));
  temporaryDirs.push(dir);
  cpSync(join(PACKAGE_DIR, 'src'), join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'locales', `${locale}.json`), JSON.stringify({ feedback: prefixes }));
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('the prefix stylesheet', () => {
  it.each([
    ['nn', ':root,\n:lang(nn) {', '✓ Riktig:', '✗ Feil:'],
    ['nb', ':lang(nb),\n:lang(no) {', '✓ Riktig:', '✗ Feil:'],
    ['en', ':lang(en) {', '✓ Correct:', '✗ Incorrect:'],
  ])('[UD-003] carries the %s prefixes for its language', (_locale, selector, correct, incorrect) => {
    const block = css.slice(css.indexOf(selector)).split('}')[0] ?? '';
    expect(block).toContain(`--hvl-feedback-correct-prefix: '${correct}';`);
    expect(block).toContain(`--hvl-feedback-incorrect-prefix: '${incorrect}';`);
    expect(block).toContain(`--hvl-feedback-correct-label: '${correct.slice(2)}';`);
    expect(block).toContain(`--hvl-feedback-incorrect-label: '${incorrect.slice(2)}';`);
  });

  it.each(ENTRIES.flatMap((e) => STATES.map((state) => [`${e.library} (${state})`, e, state] as const)))(
    '[UD-003] %s shows an icon and a text before the answer, with empty alternative text',
    (_label, entry, state) => {
      // Arrange
      const selector = `${entry.prefixOn?.[state] ?? entry[state]}::before`;
      // Act
      const rule = css
        .split('\n\n')
        .find((r) => (r.split(' {')[0] ?? '').split(',\n').includes(selector) && r.includes('content:'));
      // Assert: the library's own ✓/✗ is the icon where it draws one; otherwise the prefix carries it.
      const part = entry.ownIcon ? 'label' : 'prefix';
      expect(rule).toContain(`content: var(--hvl-feedback-${state}-${part}) / '';`);
    },
  );

  it('[UD-003] gives the script both target lists on :root', () => {
    for (const state of STATES) {
      expect(css).toContain(`--hvl-feedback-${state}-targets: '${ENTRIES.map((e) => e[state]).join(', ')}';`);
    }
  });

  it('[UD-003] covers MultiChoice, Blanks, DragText and the explanations QuestionSet shows', () => {
    for (const library of [
      '.h5p-multichoice',
      '.h5p-blanks',
      '.h5p-drag-text',
      '.h5p-question-explanation',
    ]) {
      expect(ENTRIES.some((e) => e.correct.startsWith(library) && e.incorrect.startsWith(library))).toBe(
        true,
      );
    }
  });

  it('[UD-003] the committed stylesheet matches the locales and targets', () => {
    expect(readFileSync(OUTPUT_FILE, 'utf8')).toBe(css);
    expect(prefixCss(readInputs())).toBe(css);
  });

  it('[UD-003] --check fails when the committed file is stale and passes when it is current', () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), 'hvl-prefixes-out-'));
    temporaryDirs.push(dir);
    const out = join(dir, 'out.css');
    writeFileSync(out, `${css}/* edit */\n`);
    // Act
    const stale = main(['--check', `--out=${out}`]);
    writeFileSync(out, css);
    const current = main(['--check', `--out=${out}`]);
    // Assert
    expect([stale, current]).toEqual([1, 0]);
  });
});

describe('the prefix rules', () => {
  it('[UD-003] a prefix must start with its icon', () => {
    expect(labelOf('✓ Riktig:', 'correct')).toBe('Riktig:');
    expect(() => labelOf('Riktig:', 'correct')).toThrow(/must start with/);
    expect(() => labelOf('✓ Feil:', 'incorrect')).toThrow(/must start with/);
    expect(() => labelOf("✓ Rett'", 'correct')).toThrow(/quotes/);
  });

  it('[UD-003] the build refuses a locale whose prefix lacks its icon and writes nothing', () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dir = packageCopyWith('nb', { correctPrefix: 'Riktig:', incorrectPrefix: '✗ Feil:' });
    const out = join(dir, 'dist', 'out.css');
    // Act
    const code = main([`--dir=${dir}`, `--out=${out}`]);
    // Assert
    expect(code).toBe(1);
    expect(() => readFileSync(out)).toThrow();
  });
});
