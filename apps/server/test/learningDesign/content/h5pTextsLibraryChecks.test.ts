/**
 * Tests for the H5P texts' check against the installed libraries in `content:check`: an entry whose library, field or
 * library string does not exist, or whose `en` is no longer the library's English text, is refused with its file,
 * line and key; the guidance must go under a video field of a library without an English language file. The real
 * texts pass against the pinned libraries.
 *
 * Spec: H5P-008, H5P-010
 */
import { describe, expect, it } from 'vitest';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { loadH5pTextsContent } from '../../../src/learningDesign/content/h5pTextsContent.js';
import {
  readInstalledLibraries,
  type InstalledLibraryCatalogue,
} from '../../../src/learningDesign/content/installedLibraries.js';
import { STUDIO_CONTENT_ROOT } from '../../../src/learningDesign/content/loadStudioContent.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { FIXTURE_EN, FIXTURE_SEMANTICS } from '../../h5p/languageOverlay/overlayFixtures.js';
import { h5pTextsRoot, VALID_GUIDANCE, VALID_NB, VALID_NN } from './h5pTextsFixture.js';

/** H5P.Fixture 1.0 installed, with an English language file only when `withEnJson`. */
const catalogue = (options: { english?: object; withEnJson?: boolean } = {}): InstalledLibraryCatalogue => ({
  versionsOf: (name) => (name === 'H5P.Fixture' ? [{ major: 1, minor: 0 }] : []),
  semanticsOf: (library) =>
    library === 'H5P.Fixture 1.0' ? (FIXTURE_SEMANTICS as ISemanticsEntry[]) : undefined,
  languageFileOf: (library, code) =>
    library !== 'H5P.Fixture 1.0'
      ? undefined
      : code === '.en'
        ? (options.english ?? FIXTURE_EN)
        : options.withEnJson
          ? {}
          : undefined,
});

const problemsWith = (files: Parameters<typeof h5pTextsRoot>[0], installed = catalogue()) => {
  const folder = '/libraries';
  const loaded = loadH5pTextsContent({
    root: h5pTextsRoot(files),
    phases: undefined,
    references: undefined,
    installedLibraries: { kind: 'installed', folder, catalogue: installed },
  });
  return loaded.ok
    ? []
    : loaded.problems.map((p) => `${p.file.split('/').pop()}:${p.line}: ${p.key}: ${p.message}`);
};

describe('[H5P-008] the H5P texts against the installed libraries', () => {
  it('[H5P-008] the fixture texts match the fixture library', () => {
    expect(problemsWith({})).toEqual([]);
  });

  it("[H5P-008] refuses an en that is no longer the library's English text, naming the new one", () => {
    // Act
    const problems = problemsWith({ nn: VALID_NN.replace('en: "Submit"', 'en: "Send"') });
    // Assert
    expect(problems).toEqual([
      'library-texts.nn.yaml:6: libraries.H5P.Fixture 1.0.defaults.UI.submit.en: ' +
        'is not the library\'s English text any more, which is now "Submit"; update en and check the translation',
    ]);
  });

  it('[H5P-008] refuses a field the library does not have, and a default on a field without one', () => {
    // Act
    const problems = problemsWith({
      nb:
        VALID_NB.replace('steps[].proceed', 'steps[].next') +
        '      question:\n        en: "Q"\n        nb: "S"\n',
    });
    // Assert
    expect(problems).toEqual([
      'library-texts.nb.yaml:5: libraries.H5P.Fixture 1.0.defaults.steps[].next: is not a field of H5P.Fixture 1.0; check the spelling',
      'library-texts.nb.yaml:8: libraries.H5P.Fixture 1.0.defaults.question: this field of H5P.Fixture 1.0 has no default text to translate',
    ]);
  });

  it('[H5P-008] refuses a library string the library does not have, or whose English changed', () => {
    // Act
    const unknown = problemsWith({}, catalogue({ english: { libraryStrings: { copy: 'Copy' } } }));
    const changed = problemsWith({}, catalogue({ english: { libraryStrings: { paste: 'Paste here' } } }));
    // Assert
    expect(unknown).toEqual([
      'library-texts.nn.yaml:13: libraries.H5P.Fixture 1.0.libraryStrings.paste: is not a library string of H5P.Fixture 1.0',
    ]);
    expect(changed).toEqual([
      expect.stringMatching(/libraryStrings\.paste\.en: .*which is now "Paste here"/),
    ]);
  });

  it('[H5P-008] refuses a library version that is not installed', () => {
    // Act
    const problems = problemsWith({ nb: VALID_NB.replace('H5P.Fixture 1.0', 'H5P.Fixture 1.1') });
    // Assert
    expect(problems).toEqual([
      'library-texts.nb.yaml:3: libraries.H5P.Fixture 1.1: H5P.Fixture 1.1 is not installed; correct the version, or run npm run h5p:fetch-libraries',
    ]);
  });

  it('[H5P-010] refuses guidance under a field that is not a video field, or for a library with language/en.json', () => {
    // Act
    const notVideo = problemsWith({ guidance: VALID_GUIDANCE.replace('field: video', 'field: question') });
    const withEnJson = problemsWith({}, catalogue({ withEnJson: true }));
    // Assert
    expect(notVideo).toEqual(['video-guidance.yaml:8: fields[#1].field: is a text field, not a video field']);
    expect(withEnJson).toEqual([
      'video-guidance.yaml:7: fields[#1].library: H5P.Fixture 1.0 has language/en.json, whose description would hide the English guidance in the editor',
    ]);
  });
});

describeWithRealPackages('[H5P-008] the real H5P texts against the pinned libraries', () => {
  it('[H5P-008] every entry names an installed field or string, and every en is the library’s English text', () => {
    // Act
    const loaded = loadH5pTextsContent({
      root: STUDIO_CONTENT_ROOT,
      phases: undefined,
      references: undefined,
      installedLibraries: readInstalledLibraries(undefined, true),
    });
    // Assert
    expect(loaded.ok ? [] : loaded.problems).toEqual([]);
    expect(loaded.ok && loaded.value.libraryCheck).toBe('checked');
  });
});
