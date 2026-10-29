/**
 * Tests for the pattern checks against the installed libraries (D-084 amendment): the main library must be the
 * version the editor offers, each sub-content a version its field offers, and every filled-in text must fit its
 * field's limit; and what `content:check` does when the libraries are not installed. The library tests read the
 * pinned libraries `npm run h5p:fetch-libraries` installs, so they skip without them locally and fail in CI; a
 * sub-content version a field offers but no folder holds is shown with a stand-in catalogue.
 *
 * Spec: PED-010, PED-011
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import {
  readInstalledLibraries,
  type InstalledLibraryCatalogue,
} from '../../../src/learningDesign/content/installedLibraries.js';
import { describePatternContent } from '../../../src/learningDesign/content/patternContent.js';
import { skeletonLibraryProblems } from '../../../src/learningDesign/content/skeletonLibraryChecks.js';
import {
  editedPatternFixture,
  FIXTURE_PATTERN_DIR,
  loadFixturePatterns,
  PATTERN_FIXTURE_ROOT,
  removePatternFixtureCopies,
} from '../../support/fixturePattern.js';
import { describeWithRealPackages } from '../../support/realPackages.js';

const YAML = `${FIXTURE_PATTERN_DIR}/pattern.yaml`;
const QUESTION_SET = `${FIXTURE_PATTERN_DIR}/skeleton.H5P.QuestionSet.json`;

afterAll(removePatternFixtureCopies);

describeWithRealPackages('[PED-010] skeletons against the installed libraries', () => {
  const installedLibraries = readInstalledLibraries();
  const problemsOf = (edits: Parameters<typeof editedPatternFixture>[0]): ContentProblem[] => {
    const loaded = loadFixturePatterns(editedPatternFixture(edits), { installedLibraries });
    if (loaded.ok) throw new Error('expected the edited fixture to be refused');
    return loaded.problems.map((p) => ({ ...p, file: p.file.split('/').slice(-1)[0] ?? '' }));
  };

  it('[PED-011] passes the fixture pattern as written, and says the libraries were checked', () => {
    // Act
    const loaded = loadFixturePatterns(PATTERN_FIXTURE_ROOT, { installedLibraries });
    // Assert
    expect(loaded.ok && loaded.value.libraryCheck).toBe('checked');
  });

  it('[PED-010] names a main library that is not the newest installed minor version', () => {
    // Act
    const problems = problemsOf({
      [QUESTION_SET]: (t) => t.replace('H5P.QuestionSet 1.21', 'H5P.QuestionSet 1.20'),
    });
    // Assert
    expect(problems).toEqual([
      {
        file: 'skeleton.H5P.QuestionSet.json',
        line: 2,
        key: 'library',
        message:
          'names H5P.QuestionSet 1.20, but the editor offers H5P.QuestionSet 1.21, the newest installed version; ' +
          'name H5P.QuestionSet 1.21',
      },
    ]);
  });

  it('[PED-010] names a sub-content version its field does not offer, and DragQuestion, which the server never offers', () => {
    // Act
    const problems = problemsOf({
      [QUESTION_SET]: (t) =>
        t
          .replace('H5P.MultiChoice 1.16', 'H5P.MultiChoice 1.15')
          .replace('H5P.TrueFalse 1.8', 'H5P.DragQuestion 1.15'),
    });
    // Assert
    expect(problems.map((p) => [p.file, p.key, p.message.split(';')[0]])).toEqual([
      [
        'skeleton.H5P.QuestionSet.json',
        'params.questions[#1].library',
        'names H5P.MultiChoice 1.15, which this field does not offer',
      ],
      [
        'skeleton.H5P.QuestionSet.json',
        'params.questions[#3].library',
        'names H5P.DragQuestion 1.15, which this field does not offer',
      ],
    ]);
    expect(problems[0]?.message).toContain('it offers H5P.MultiChoice 1.16, H5P.Blanks 1.14');
    expect(problems[1]?.message).not.toContain('it offers H5P.DragQuestion');
  });

  it('[PED-010] names a text that, filled in and escaped as H5P stores it, is longer than its field allows', () => {
    // Arrange: 500 ampersands are 2 500 characters as H5P stores them; TrueFalse's feedback allows 2 048
    const ampersands = `'${'&'.repeat(500)}'`;
    // Act
    const problems = problemsOf({
      [YAML]: (t) =>
        t.replace('    en: ⟦Explain why the statement is true or false⟧', `    en: ${ampersands}`),
    });
    // Assert
    expect(problems.map((p) => [p.file, p.key])).toEqual([
      ['skeleton.H5P.QuestionSet.json', 'params.questions[#3].params.behaviour.feedbackOnCorrect'],
      ['skeleton.H5P.QuestionSet.json', 'params.questions[#3].params.behaviour.feedbackOnWrong'],
    ]);
    expect(problems[0]?.message).toBe(
      'is too long once filled in (2500 characters in en, with & < > counted as H5P stores them); this field ' +
        'allows at most 2048, and H5P would cut the rest',
    );
  });
});

describe('[PED-010] a sub-content version its field offers but that is not installed', () => {
  it('[PED-010] names the sub-content as not installed, at its library key', () => {
    // Arrange: a field that offers H5P.Text 1.1, which no library folder holds
    const semantics = [{ name: 'content', type: 'library', options: ['H5P.Text 1.1'] }] as ISemanticsEntry[];
    const catalogue: InstalledLibraryCatalogue = {
      versionsOf: (name) => (name === 'H5P.Column' ? [{ major: 1, minor: 22 }] : []),
      semanticsOf: (library) => (library === 'H5P.Column 1.22' ? semantics : undefined),
    };
    const params = { content: { library: 'H5P.Text 1.1', params: {} } };
    const skeleton = {
      value: { library: 'H5P.Column 1.22', metadataTitle: 'Tittel', params },
      file: 'skeleton.json',
      locate: (path: readonly (string | number)[]) => ({ key: path.join('.') }),
    };
    // Act
    const problems = skeletonLibraryProblems(skeleton, {}, catalogue);
    // Assert
    expect(problems.map((p) => [p.key, p.message.split(' (')[0]])).toEqual([
      ['params.content.library', 'names H5P.Text 1.1, which is not installed'],
    ]);
  });
});

describe('[PED-011] content:check without the installed libraries', () => {
  const missing = (required: boolean) => readInstalledLibraries('/nonexistent/h5p-libraries', required);

  it('[PED-011] says once that the library checks did not run, and fails only where they are required (CI)', () => {
    // Act
    const local = loadFixturePatterns(PATTERN_FIXTURE_ROOT, { installedLibraries: missing(false) });
    const ci = loadFixturePatterns(PATTERN_FIXTURE_ROOT, { installedLibraries: missing(true) });
    // Assert
    expect(local.ok && describePatternContent(local.value)).toBe(
      '1 pattern (library versions and field limits not checked: run npm run h5p:fetch-libraries)',
    );
    expect(ci.ok ? [] : ci.problems).toEqual([
      {
        file: '/nonexistent/h5p-libraries',
        message: expect.stringMatching(
          /^the installed H5P libraries are missing.*npm run h5p:fetch-libraries/,
        ),
      },
    ]);
  });

  it('[PED-011] does not fail CI for missing libraries when there is no pattern to check', () => {
    // Act
    const loaded = loadFixturePatterns('/nonexistent/content', { installedLibraries: missing(true) });
    // Assert
    expect(loaded.ok && loaded.value.patterns).toEqual([]);
  });
});
