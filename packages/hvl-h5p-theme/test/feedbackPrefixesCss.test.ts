/**
 * Tests for the generated prefix stylesheet: the three locales' prefixes, the `:lang()` selection, the empty
 * alternative text of the visible prefix, the targets whose label the script shows as text, the checks on the
 * target list, and drift detection of the committed file.
 *
 * Spec: UD-003, UD-010
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { labelOf, main, OUTPUT_FILE, prefixCss, readInputs } from '../scripts/buildFeedbackPrefixes.mjs';
import { targetEntries } from '../scripts/feedbackTargetList.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('../', import.meta.url));
interface TargetEntry {
  library: string;
  correct?: string;
  incorrect?: string;
  prefixOn?: 'label' | { correct?: string; incorrect?: string };
  prefixPseudo?: 'before' | 'after';
  ownIcon: boolean;
}

const css = prefixCss(readInputs());
const ENTRIES = (readInputs().targets as { targets: TargetEntry[] }).targets;
const STATES = ['correct', 'incorrect'] as const;
const temporaryDirs: string[] = [];
const ENTRY_STATES = ENTRIES.flatMap((e) =>
  STATES.filter((state) => e[state]).map((state) => [e, state] as const),
);
const DRAWN = ENTRY_STATES.filter(([e]) => e.prefixOn !== 'label');
const SHOWN = ENTRY_STATES.filter(([e]) => e.prefixOn === 'label');
const rulesOf = (selector: string) =>
  css.split('\n\n').filter((r) => (r.split(' {')[0] ?? '').split(',\n').includes(selector));

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

  it.each(DRAWN.map(([e, state]) => [`${e.library} (${state})`, e, state] as const))(
    '[UD-003] %s shows an icon and a text with the answer, with empty alternative text',
    (_label, entry, state) => {
      // Arrange
      const on = (typeof entry.prefixOn === 'object' && entry.prefixOn[state]) || entry[state] || '';
      const selector = `${on.includes(',') ? `:is(${on})` : on}::${entry.prefixPseudo ?? 'before'}`;
      // Act
      const rule = rulesOf(selector).find((r) => r.includes('content:'));
      // Assert: the library's own ✓/✗ is the icon where it draws one; otherwise the prefix carries it.
      const part = entry.ownIcon ? 'label' : 'prefix';
      expect(rule).toContain(`content: var(--hvl-feedback-${state}-${part}) / '';`);
    },
  );

  it.each(SHOWN.map(([e, state]) => [`${e.library} (${state})`, e, state] as const))(
    '[UD-003] %s has its label shown as text by the script, beside its own icon, and no ::before',
    (_label, entry, state) => {
      const selector = entry[state] ?? '';
      const shown = /--hvl-feedback-(\w+)-shown: '([^']*)';/g;
      const lists = Object.fromEntries([...css.matchAll(shown)].map((m) => [m[1], m[2]?.split(', ') ?? []]));
      expect(lists[state]).toEqual(expect.arrayContaining(selector.split(', ')));
      expect(entry.ownIcon).toBe(true);
      expect(css).not.toContain(`${selector}::before`);
    },
  );

  it('[UD-003] gives the script both target lists on :root, with every entry that names the state', () => {
    for (const state of STATES) {
      const targets = ENTRIES.flatMap((e) => (e[state] ? [e[state]] : []));
      expect(css).toContain(`--hvl-feedback-${state}-targets: '${targets.join(', ')}';`);
    }
  });

  it('[UD-003] covers the question types the ten types offer, also inside containers', () => {
    // Arrange: MultiChoice, Blanks, DragText, QuestionSet's explanations, and the sub-content of QuestionSet,
    // CoursePresentation, InteractiveVideo and Column (TrueFalse, MarkTheWords, SingleChoiceSet, Summary,
    // MultiMediaChoice, ImageHotspotQuestion)
    const libraries = [
      '.h5p-multichoice',
      '.h5p-blanks',
      '.h5p-drag-text',
      '.h5p-question-explanation',
      '.h5p-true-false',
      '.h5p-mark-the-words',
      '.h5p-sc-alternative',
      '.h5p-summary',
      '.h5p-multi-media-choice',
      '.h5p-image-hotspot-question',
    ];
    // Act
    const covered = libraries.filter((library) =>
      STATES.every((state) => ENTRIES.some((e) => e[state]?.startsWith(library))),
    );
    // Assert
    expect(covered).toEqual(libraries);
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

describe('the target list', () => {
  it('[UD-003] refuses an entry without a state, a shown label without the library icon, an unsafe selector and an unknown pseudo-element', () => {
    const check = (entry: object) => () => targetEntries({ targets: [{ library: 'X', ...entry }] });
    expect(check({ ownIcon: true })).toThrow(/neither a correct nor an incorrect/);
    expect(check({ correct: '.a', prefixOn: 'label', ownIcon: false })).toThrow(/ownIcon: true/);
    expect(check({ correct: "[a='b']", ownIcon: true })).toThrow(/unsafe selector/);
    expect(check({ correct: '.a', ownIcon: 'yes' })).toThrow(/ownIcon/);
    expect(check({ correct: '.a', prefixPseudo: 'marker', ownIcon: false })).toThrow(/prefixPseudo/);
    expect(check({ correct: '.a', prefixOn: 'label', prefixPseudo: 'after', ownIcon: true })).toThrow(
      /draws none/,
    );
    expect(check({ correct: '.a', ownIcon: false })()).toHaveLength(1);
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
