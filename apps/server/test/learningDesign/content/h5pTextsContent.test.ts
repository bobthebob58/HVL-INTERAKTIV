/**
 * Tests for the H5P texts in `content/h5p-tekstar/`: the real files load into the overlay the engine uses, a folder
 * without files is no texts, and a broken file is refused by the loader and by `npm run content:check` with its file,
 * line and key.
 *
 * Spec: H5P-008, H5P-010
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../../../src/learningDesign/content/contentProblem.js';
import {
  describeH5pTextsContent,
  loadH5pTextsContent,
  loadLanguageOverlay,
} from '../../../src/learningDesign/content/h5pTextsContent.js';
import { STUDIO_CONTENT_ROOT } from '../../../src/learningDesign/content/loadStudioContent.js';
import { runContentCheck } from '../../../src/learningDesign/content/runContentCheck.js';
import { StudioContentError } from '../../../src/learningDesign/content/StudioContentError.js';
import { h5pTextsRoot, VALID_NN } from './h5pTextsFixture.js';

const load = (root: string) => loadH5pTextsContent({ root, phases: undefined, references: undefined });
const problemsOf = (root: string) => {
  const loaded = load(root);
  return loaded.ok
    ? []
    : loaded.problems.map((p) => `${p.file.split('/').pop()}:${p.line ?? ''}: ${p.key ?? ''}: ${p.message}`);
};

describe('[H5P-008] the H5P texts in content/h5p-tekstar/', () => {
  it('[H5P-008] the real files load into an overlay for nn and nb with the video guidance', () => {
    // Act
    const overlay = loadLanguageOverlay();
    const multiChoice = overlay.edits['H5P.MultiChoice 1.16'];
    // Assert
    expect(multiChoice?.nn).toContainEqual({
      kind: 'field',
      property: 'default',
      path: 'UI.submitAnswerButton',
      text: 'Send inn',
      english: 'Submit',
    });
    expect(overlay.edits['H5P.DragNBar 1.5']?.nb).toContainEqual(
      expect.objectContaining({ kind: 'libraryString', key: 'paste', text: 'Lim inn', english: 'Paste' }),
    );
    expect(overlay.videoGuidance?.fields).toEqual([
      { library: 'H5P.InteractiveVideo 1.28', path: 'interactiveVideo.video.files' },
      { library: 'H5P.Video 1.6', path: 'sources' },
    ]);
    for (const language of ['nn', 'nb'] as const)
      expect(overlay.edits['H5P.Video 1.6']?.[language]).toEqual([
        expect.objectContaining({ kind: 'field', property: 'description', path: 'sources' }),
      ]);
    expect(Object.isFrozen(overlay.edits)).toBe(true);
  });

  it('[H5P-008] builds each language’s edits from its own file, and the guidance in both', () => {
    // Act
    const loaded = load(h5pTextsRoot());
    // Assert
    expect(loaded.ok && loaded.value.overlay.edits['H5P.Fixture 1.0']).toEqual({
      nn: [
        { kind: 'field', property: 'default', path: 'UI.submit', text: 'Send inn', english: 'Submit' },
        {
          kind: 'field',
          property: 'label',
          path: 'UI.submit',
          text: 'Namn på «Send inn»-knappen',
          english: 'Submit button label',
        },
        { kind: 'libraryString', key: 'paste', text: 'Lim inn', english: 'Paste' },
        { kind: 'field', property: 'description', path: 'video', text: 'Bruk Panopto.' },
      ],
      nb: [
        {
          kind: 'field',
          property: 'default',
          path: 'steps[].proceed',
          text: 'Gå videre',
          english: 'Proceed',
        },
        { kind: 'field', property: 'description', path: 'video', text: 'Bruk Panopto.' },
      ],
    });
    expect(loaded.ok && describeH5pTextsContent(loaded.value)).toBe(
      'H5P texts: 3 in nn, 1 in nb, video guidance on 1 fields (draft)',
    );
  });

  it('[H5P-008] a folder without the files is no texts; one file missing is a problem naming it', () => {
    // Act
    const none = load(mkdtempSync(join(tmpdir(), 'hvli-no-texts-')));
    // Assert
    expect(none.ok && none.value.overlay.edits).toEqual({});
    expect(none.ok && describeH5pTextsContent(none.value)).toBe('no H5P texts yet');
    expect(problemsOf(h5pTextsRoot({ nb: null }))).toEqual([
      expect.stringMatching(/^library-texts\.nb\.yaml:: : is missing: the H5P texts need/),
    ]);
  });

  it.each([
    [
      'markup in a text',
      VALID_NN.replace('"Send inn"', '"<b>Send inn</b>"'),
      /UI\.submit\.nn: must not hold < or >/,
    ],
    // SECURITY: a library would end its double-quoted attribute there; `en` may hold one (H5P's labels do).
    [
      'a straight double quote in HVL’s text',
      VALID_NN.replace('en: "Paste"', `en: 'Paste "here"'`).replace('nn: "Lim inn"', `nn: 'Lim "inn"'`),
      /^(?![\s\S]*paste\.en:)[\s\S]*paste\.nn: must not hold " \(write «» for quotation marks\)/,
    ],
    ['a missing translation', VALID_NN.replace('        nn: "Lim inn"\n', ''), /paste\.nn: is missing/],
    [
      'the other language’s key',
      VALID_NN.replace('nn: "Lim inn"', 'nb: "Lim inn"'),
      /paste\.nb: is not a known key/,
    ],
    ['an unknown group', VALID_NN.replace('libraryStrings:', 'strings:'), /strings: is not a known key/],
    [
      'a field path with spaces',
      VALID_NN.replace('UI.submit:\n        en: "Submit"', 'UI submit:\n        en: "Submit"'),
      /is not a field path/,
    ],
    [
      'a library without a version',
      VALID_NN.replace('H5P.Fixture 1.0', 'H5P.Fixture'),
      /is not a library version/,
    ],
    ['a prototype key', VALID_NN.replace('paste:', '__proto__:'), /library string key|__proto__/],
    [
      'a repeated key',
      VALID_NN.replace('      paste:', '      paste:\n        en: "x"\n        nn: "y"\n      paste:'),
      /appears more than once/,
    ],
  ])('[H5P-008] refuses %s with its line and key', (_case, text, message) => {
    // Act
    const problems = problemsOf(h5pTextsRoot({ nn: text }));
    // Assert
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(message);
    expect(problems.every((line) => /^library-texts\.nn\.yaml:\d+: /.test(line))).toBe(true);
  });

  it('[H5P-010] refuses video guidance without a field, with a text missing or with a straight double quote', () => {
    // Act
    const problems = problemsOf(
      h5pTextsRoot({
        guidance: `status: draft\ndescription:\n  nn: 'Bruk "Panopto"'\n  nb: "b"\nfields: []\n`,
      }),
    );
    // Assert
    expect(problems.join('\n')).toMatch(/description\.en: is missing/);
    expect(problems.join('\n')).toMatch(/description\.nn: must not hold "/);
    expect(problems.join('\n')).toMatch(/fields: must list at least one video field/);
  });

  it('[H5P-008] loadLanguageOverlay throws every problem, so an engine never starts on a broken file', () => {
    expect(() => loadLanguageOverlay(h5pTextsRoot({ guidance: 'status: final\n' }))).toThrow(
      StudioContentError,
    );
  });

  it('[H5P-008] content:check fails on a broken H5P texts file in a copy of the real content', () => {
    // Arrange
    const copy = mkdtempSync(join(tmpdir(), 'hvli-content-'));
    cpSync(STUDIO_CONTENT_ROOT, copy, { recursive: true });
    const file = join(copy, 'h5p-tekstar', 'library-texts.nn.yaml');
    const original = readFileSync(file, 'utf8');
    const broken = original.replace(/nn: (['"])Send inn\1/, "nn: '<Send inn>'");
    expect(broken).not.toBe(original);
    writeFileSync(file, broken);
    const lines: string[] = [];
    // Act
    const code = runContentCheck([`--root=${copy}`], {
      output: { log: (line) => lines.push(line), error: (line) => lines.push(line) },
      baseDirectory: REPOSITORY_ROOT,
    });
    // Assert
    expect(code).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /library-texts\.nn\.yaml:\d+: libraries\.H5P\.MultiChoice 1\.16\.defaults\.UI\.submitAnswerButton\.nn: must not hold < or >/,
      ),
    );
  });
});
