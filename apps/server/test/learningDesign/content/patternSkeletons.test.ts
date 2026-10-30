/**
 * Tests for the checks between a pattern's `pattern.yaml` and its skeletons that need no installed library: tokens
 * and texts match, titles fit, guidance in a blank cannot be misread, and each skeleton file has its form. Each test
 * edits a copy of the fixture pattern and expects the file and the key of its one mistake.
 *
 * Spec: PED-010, PED-011
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import {
  editedPatternFixture,
  FIXTURE_PATTERN_DIR,
  loadFixturePatterns,
  removePatternFixtureCopies,
} from '../../support/fixturePattern.js';

const YAML = `${FIXTURE_PATTERN_DIR}/pattern.yaml`;
const QUESTION_SET = `${FIXTURE_PATTERN_DIR}/skeleton.H5P.QuestionSet.json`;
const BLANKS = `${FIXTURE_PATTERN_DIR}/skeleton.H5P.Blanks.json`;

const problemsOf = (edits: Parameters<typeof editedPatternFixture>[0]): ContentProblem[] => {
  const loaded = loadFixturePatterns(editedPatternFixture(edits));
  if (loaded.ok) throw new Error('expected the edited fixture to be refused');
  return loaded.problems.map((p) => ({ ...p, file: p.file.split('/').slice(-1)[0] ?? '' }));
};

afterAll(removePatternFixtureCopies);

describe('[PED-010] tokens between pattern.yaml and the skeletons', () => {
  it('[PED-010] names a token without a text in the skeleton, and the text no skeleton uses in pattern.yaml', () => {
    // Act
    const problems = problemsOf({ [QUESTION_SET]: (t) => t.replace('{{tfTitle}}', '{{tfTitel}}') });
    // Assert
    expect(problems).toEqual([
      {
        file: 'pattern.yaml',
        line: expect.any(Number),
        key: 'texts.tfTitle',
        message: 'is not used by any skeleton; use {{tfTitle}} in one, or remove the text',
      },
      {
        file: 'skeleton.H5P.QuestionSet.json',
        line: expect.any(Number),
        key: 'params.questions[#3].metadata.title',
        message: 'uses {{tfTitel}}, but pattern.yaml has no text "tfTitel" under texts',
      },
    ]);
  });

  it('[PED-010] names a brace that is not part of a token, and a token name that is not one', () => {
    // Act
    const problems = problemsOf({
      [BLANKS]: (t) => t.replace('<p>{{blanksTask}}</p>', '<p>{{blanksTask}} {{ blanks task }} }}</p>'),
    });
    // Assert
    expect(problems.map((p) => [p.file, p.key, p.message])).toEqual([
      ['skeleton.H5P.Blanks.json', 'params.text', 'has a {{ or }} that is not part of a {{token}}'],
      ['skeleton.H5P.Blanks.json', 'params.text', 'has {{ blanks task }}, which is not a token name'],
    ]);
  });

  it('[PED-010] names a text that holds a token, since texts are filled in as they are', () => {
    // Act
    const problems = problemsOf({
      [YAML]: (t) => t.replace('    nn: ⟦Rett svar⟧', '    nn: ⟦Rett {{svar}}⟧'),
    });
    // Assert
    expect(problems.map((p) => [p.file, p.key, p.message])).toEqual([
      [
        'pattern.yaml',
        'texts.mcRight',
        'holds {{ or }}; a text is filled into the skeleton as it is and cannot hold a token',
      ],
    ]);
  });
});

describe('[PED-010] what the filled-in skeleton would show', () => {
  it("[PED-010] names guidance with ':' inside a blank, in the language whose text has it", () => {
    // Act
    const problems = problemsOf({
      [YAML]: (t) => t.replace('    nb: ⟦begrepet⟧', "    nb: '⟦Skriv: begrepet⟧'"),
    });
    // Assert
    expect(problems.map((p) => [p.file, p.key])).toEqual([
      ['skeleton.H5P.Blanks.json', 'params.questions[#1]'],
      ['skeleton.H5P.QuestionSet.json', 'params.questions[#2].params.questions[#1]'],
    ]);
    expect(problems[0]?.message).toContain('(nb: «⟦Skriv: begrepet⟧»)');
    expect(problems[0]?.message).toMatch(
      /^has guidance inside a blank or a draggable word \(between \* and \*\)/,
    );
  });

  it("[PED-010] names guidance with '/' inside a DragText draggable word, in its text and its distractors", () => {
    // Act
    const problems = problemsOf({
      [QUESTION_SET]: (t) =>
        t
          .replace('"library": "H5P.Blanks 1.14"', '"library": "H5P.DragText 1.10"')
          .replace(
            '"questions": ["<p>{{blanksSentence}}: *{{blanksAnswer}}*</p>"]',
            '"textField": "{{blanksSentence}}: *{{blanksAnswer}}*",\n"distractors": "*⟦ord/uttrykk⟧*"',
          ),
      [YAML]: (t) => t.replace('    en: ⟦the concept⟧', "    en: '⟦the concept/term⟧'"),
    });
    // Assert
    expect(problems.map((p) => [p.file, p.key])).toEqual([
      ['skeleton.H5P.Blanks.json', 'params.questions[#1]'],
      ['skeleton.H5P.QuestionSet.json', 'params.questions[#2].params.textField'],
      ['skeleton.H5P.QuestionSet.json', 'params.questions[#2].params.distractors'],
    ]);
    expect(problems[1]?.message).toContain('(en: «⟦the concept/term⟧»)');
    expect(problems[2]?.message).toContain('(nn: «⟦ord/uttrykk⟧»; nb: «⟦ord/uttrykk⟧»; en: «⟦ord/uttrykk⟧»)');
  });

  it('[PED-010] names a title that is too long once filled in and escaped, and one with a line break', () => {
    // Act
    const tooLong = problemsOf({
      [YAML]: (t) => t.replace('    en: ⟦Title of the check⟧', `    en: '${'Q&A '.repeat(60)}'`),
    });
    const broken = problemsOf({
      [BLANKS]: (t) => t.replace('"metadataTitle": "{{title}}"', '"metadataTitle": "Del 1\\n{{title}}"'),
    });
    // Assert
    expect(tooLong.map((p) => [p.file, p.key])).toEqual([
      ['skeleton.H5P.Blanks.json', 'metadataTitle'],
      ['skeleton.H5P.QuestionSet.json', 'metadataTitle'],
    ]);
    expect(tooLong[0]?.message).toContain('(479 characters in en, with & < > counted as H5P stores them)');
    expect(broken.map((p) => [p.key, p.message])).toEqual([
      ['metadataTitle', 'is a title and must be one line'],
    ]);
  });
});

describe('[PED-010] the form of a skeleton file', () => {
  it.each([
    ['is not JSON', (t: string) => t.replace('"library"', 'library'), undefined, /^is not valid JSON: /],
    [
      'has no version in its library',
      (t: string) => t.replace('H5P.Blanks 1.14', 'H5P.Blanks'),
      'library',
      /^must name the library with its version/,
    ],
    [
      'is for another content type',
      (t: string) => t.replace('H5P.Blanks 1.14', 'H5P.MultiChoice 1.16'),
      'library',
      /^names H5P.MultiChoice 1.16, but this file is the H5P.Blanks skeleton/,
    ],
    [
      'has an unknown key',
      (t: string) => t.replace('"metadataTitle"', '"title": "x", "metadataTitle"'),
      'title',
      /^is not a known key/,
    ],
  ])('[PED-010] names a skeleton that %s', (_, edit, key, message) => {
    // Act
    const [problem, ...others] = problemsOf({ [BLANKS]: edit });
    // Assert
    expect(others).toEqual([]);
    expect([problem?.file, problem?.key, typeof problem?.line]).toEqual([
      'skeleton.H5P.Blanks.json',
      key,
      'number',
    ]);
    expect(problem?.message).toMatch(message);
  });
});
