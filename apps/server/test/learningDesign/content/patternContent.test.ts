/**
 * Tests for the pattern loader without the installed libraries: the fixture pattern folder loads with no code
 * change, and each kind of mistake in `pattern.yaml` or a skeleton stops it with the file, the line and the key. The
 * checks against the installed libraries are in ./patternLibraryChecks.test.ts.
 *
 * Spec: PED-010, PED-011
 */
import { afterAll, describe, expect, it } from 'vitest';
import { patternCard, citedReferences } from '../../../src/learningDesign/content/patternAccessors.js';
import { describePatternContent } from '../../../src/learningDesign/content/patternContent.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import { loadReferencesContent } from '../../../src/learningDesign/content/referencesContent.js';
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import {
  editedPatternFixture,
  FIXTURE_PATTERN_DIR,
  fixturePatterns,
  loadFixturePatterns,
  PATTERN_FIXTURE_ROOT,
  removePatternFixtureCopies,
} from '../../support/fixturePattern.js';

const YAML = `${FIXTURE_PATTERN_DIR}/pattern.yaml`;

/** The problems of a fixture copy with edits, with each file shortened to its name. */
const problemsOf = (edits: Parameters<typeof editedPatternFixture>[0], renames = {}) => {
  const loaded = loadFixturePatterns(editedPatternFixture(edits, renames));
  if (loaded.ok) throw new Error('expected the edited fixture to be refused');
  return loaded.problems.map((p: ContentProblem) => ({ ...p, file: p.file.split('/').slice(-1)[0] }));
};

afterAll(removePatternFixtureCopies);

describe('[PED-011] loading a pattern folder', () => {
  it('[PED-011] loads the fixture pattern folder with no code change, phases in content order and one skeleton per type', () => {
    // Act
    const { patterns, libraryCheck } = fixturePatterns();
    // Assert
    expect(patterns.map((p) => p.id)).toEqual(['fixture-check']);
    const [pattern] = patterns;
    expect(pattern?.phases).toEqual(['forarbeid', 'etterarbeid']);
    expect(pattern?.skeletons.map((s) => [s.contentType, s.library])).toEqual([
      ['H5P.QuestionSet', 'H5P.QuestionSet 1.21'],
      ['H5P.Blanks', 'H5P.Blanks 1.14'],
    ]);
    expect(pattern?.skeletons[0]?.file).toMatch(/pattern-fixture\/laeringsdesign\/patterns\/fixture-check\//);
    expect(pattern?.citations).toEqual(['fixture2026']);
    expect(libraryCheck).toBe('not-requested');
  });

  it('[PED-011] gives the catalogue card and the cited references from the loaded files', () => {
    // Arrange
    const [pattern] = fixturePatterns().patterns;
    const references = loadReferencesContent(PATTERN_FIXTURE_ROOT);
    if (!pattern || !references.ok) throw new Error('fixture missing');
    // Act
    const card = patternCard(pattern);
    // Assert
    expect(Object.keys(card)).toEqual(['id', 'phases', 'contentTypes', 'name', 'purpose', 'buildMinutes']);
    expect(card.contentTypes).toEqual(['H5P.QuestionSet', 'H5P.Blanks']);
    expect(citedReferences(pattern, references.value).map((r) => r.key)).toEqual(['fixture2026']);
  });

  it('[PED-011] counts the patterns for content:check, and the real content/ loads with whatever patterns it has', () => {
    // Act
    const real = loadStudioContent().patterns;
    // Assert
    expect(describePatternContent(fixturePatterns())).toBe('1 pattern');
    expect(describePatternContent({ patterns: [], libraryCheck: 'checked' })).toBe('0 patterns');
    expect(describePatternContent(real)).toMatch(/^\d+ patterns?$/);
  });
});

describe('[PED-010] mistakes in pattern.yaml', () => {
  it('[PED-010] names a missing language by file, line and key', () => {
    // Act
    const problems = problemsOf({ [YAML]: (t) => t.replace('    nb: ⟦Riktig svar⟧\n', '') });
    // Assert
    expect(problems).toEqual([
      {
        file: 'pattern.yaml',
        line: expect.any(Number),
        key: 'texts.mcRight.nb',
        message: 'the nb text is missing (every text needs nn, nb and en)',
      },
    ]);
  });

  it('[PED-010] names an unknown key, a phase and a content type that do not exist, and minutes out of range', () => {
    // Act
    const problems = problemsOf({
      [YAML]: (t) =>
        t
          .replace('buildMinutes: 15', 'buildMinutes: 15\ncolour: blue')
          .replace('  - etterarbeid', '  - undervegs')
          .replace('  - H5P.Blanks', '  - H5P.DragQuestion')
          .replace('studentMinutes: 10', 'studentMinutes: 900'),
    });
    // Assert
    expect(problems.map((p) => [p.key, p.message.split(';')[0]])).toEqual([
      ['phases[#1]', '"undervegs" is not a phase key'],
      ['contentTypes[#2]', '"H5P.DragQuestion" is not one of the ten content types (e.g. H5P.Blanks)'],
      ['colour', 'is not a known key (check the spelling)'],
      ['studentMinutes', 'must be at most 600 minutes'],
    ]);
    expect(problems.every((p) => p.file === 'pattern.yaml' && typeof p.line === 'number')).toBe(true);
  });

  it('[PED-010] names the skeleton a listed content type needs when it is missing, and the one no type needs', () => {
    // Act
    const problems = problemsOf({ [YAML]: (t) => t.replace('  - H5P.Blanks', '  - H5P.DragText') });
    // Assert
    expect(problems.map((p) => [p.file, p.message.split(':')[0]])).toEqual([
      ['skeleton.H5P.Blanks.json', 'is not a file of this pattern'],
      ['skeleton.H5P.DragText.json', 'is missing'],
    ]);
    expect(problems[1]?.message).toContain('pattern.yaml lists H5P.DragText under contentTypes');
  });

  it('[PED-010] names an ID that is not the folder name, a stray file and a citation of no reference', () => {
    // Act
    const problems = problemsOf(
      {
        [YAML]: (t) => t.replace('[@fixture2026].\n  en:', '[@fixture2026] [@nobody2020].\n  en:'),
        [`${FIXTURE_PATTERN_DIR}/notes.txt`]: () => 'ALU notes',
      },
      { 'fixture-check': 'fixture-renamed' },
    );
    // Assert
    expect(problems.map((p) => [p.file, p.key, p.message.slice(0, 40)])).toEqual([
      ['notes.txt', undefined, 'is not a file of this pattern: the folde'],
      ['pattern.yaml', 'id', 'is "fixture-check", but the folder is ca'],
      ['pattern.yaml', 'whyItWorks.nb', 'cites [@fixture2026] [@nobody2020], but '],
      ['pattern.yaml', 'whyItWorks.nb', 'cites [@nobody2020], but references.yaml'],
    ]);
  });
});
