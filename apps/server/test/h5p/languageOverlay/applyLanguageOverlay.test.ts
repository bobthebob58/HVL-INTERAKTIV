/**
 * Tests for applyLanguageOverlay: HVL's texts land at the positions the editor merges, every key H5P ships stays, the
 * input is never changed, and an entry whose field is gone or whose English text changed is skipped.
 *
 * Spec: H5P-008, H5P-010
 */
import { describe, expect, it } from 'vitest';
import { applyLanguageOverlay } from '../../../src/h5p/languageOverlay/applyLanguageOverlay.js';
import type { OverlayEdit } from '../../../src/h5p/languageOverlay/languageOverlay.js';
import { FIXTURE_EN, FIXTURE_NB, FIXTURE_SEMANTICS } from './overlayFixtures.js';

const sources = { semantics: FIXTURE_SEMANTICS, englishStrings: FIXTURE_EN.libraryStrings };
const field = (path: string, text: string, english?: string, property = 'default'): OverlayEdit =>
  ({ kind: 'field', property, path, text, ...(english === undefined ? {} : { english }) }) as OverlayEdit;
const string = (key: string, text: string, english: string): OverlayEdit => ({
  kind: 'libraryString',
  key,
  text,
  english,
});

describe('[H5P-008] laying the overlay over a language file', () => {
  it('[H5P-008] sets a default and a label at the field’s position and keeps every other key', () => {
    // Act
    const { file, skipped } = applyLanguageOverlay(
      FIXTURE_NB,
      [
        field('UI.submit', 'Send inn', 'Submit'),
        field('UI.submit', 'Send inn-knapp', 'Submit button label', 'label'),
      ],
      sources,
    );
    // Assert
    expect(skipped).toEqual([]);
    expect(file).toEqual({
      semantics: [
        { label: 'Spørsmål' },
        {
          label: 'Brukergrensesnitt',
          fields: [
            { label: 'Sjekk-knapp', default: 'Sjekk' },
            { default: 'Send inn', label: 'Send inn-knapp' },
          ],
        },
      ],
      libraryStrings: { paste: 'Paste', copy: 'Kopier' },
    });
  });

  it('[H5P-008] reaches a list item’s field and fills the positions before it with {}, never null', () => {
    // Act
    const { file } = applyLanguageOverlay(
      FIXTURE_NB,
      [field('steps[].proceed', 'Gå vidare', 'Proceed'), field('tags[]', 'Merkelapp', 'Tag')],
      sources,
    );
    // Assert
    const semantics = (file as { semantics: unknown[] }).semantics;
    expect(semantics[2]).toEqual({ field: { fields: [{}, { default: 'Gå vidare' }] } });
    expect(semantics[3]).toEqual({});
    expect(semantics[4]).toEqual({ field: { default: 'Merkelapp' } });
    expect(JSON.stringify(file)).not.toContain('null');
  });

  it('[H5P-010] sets a description whatever the library says when the edit names no English text', () => {
    // Act
    const { file, skipped } = applyLanguageOverlay(
      {},
      [field('video', 'Bruk Panopto.', undefined, 'description')],
      sources,
    );
    // Assert
    expect(skipped).toEqual([]);
    expect((file as { semantics: unknown[] }).semantics[3]).toEqual({ description: 'Bruk Panopto.' });
  });

  it('[H5P-008] sets a library string and keeps the others', () => {
    // Act
    const { file } = applyLanguageOverlay(FIXTURE_NB, [string('paste', 'Lim inn', 'Paste')], sources);
    // Assert
    expect((file as { libraryStrings: unknown }).libraryStrings).toEqual({
      paste: 'Lim inn',
      copy: 'Kopier',
    });
    expect((file as { semantics: unknown }).semantics).toEqual(FIXTURE_NB.semantics);
  });

  it('[H5P-008] skips an entry whose English text changed, whose field is gone or whose string is unknown', () => {
    // Arrange
    const edits = [
      field('UI.submit', 'Send inn', 'Send'),
      field('UI.answer', 'Svar', 'Answer'),
      field('UI.check', 'Kontroller', 'Check button', 'label'),
      string('paste', 'Lim inn', 'Paste here'),
      string('cut', 'Klipp ut', 'Cut'),
      string('__proto__', 'x', 'Paste'),
    ];
    // Act
    const { file, skipped } = applyLanguageOverlay(FIXTURE_NB, edits, sources);
    // Assert
    expect(skipped).toEqual(edits);
    expect(file).toEqual(FIXTURE_NB);
  });

  it('[H5P-008] skips every field entry when the library has no semantics, and strings without an English file', () => {
    // Act
    const { skipped } = applyLanguageOverlay(
      FIXTURE_NB,
      [field('UI.submit', 'Send inn', 'Submit'), string('paste', 'Lim inn', 'Paste')],
      { semantics: undefined, englishStrings: undefined },
    );
    // Assert
    expect(skipped).toHaveLength(2);
  });

  it('[H5P-008] never changes the file it is given, and starts from {} when there is none', () => {
    // Arrange
    const before = structuredClone(FIXTURE_NB);
    // Act
    applyLanguageOverlay(
      FIXTURE_NB,
      [field('UI.check', 'Kontroller', 'Check'), string('copy', 'Kopier', 'Copy')],
      sources,
    );
    const fromNothing = applyLanguageOverlay(
      undefined,
      [field('question', 'Kva?', undefined, 'label')],
      sources,
    ).file;
    // Assert
    expect(FIXTURE_NB).toEqual(before);
    expect(fromNothing).toEqual({ semantics: [{ label: 'Kva?' }] });
  });
});
