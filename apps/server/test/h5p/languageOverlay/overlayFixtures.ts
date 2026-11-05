/**
 * overlayFixtures — a small library's semantics and language files for the language overlay's unit tests: a group of
 * texts, a list whose items are groups, a video field, and library strings in English and Bokmål.
 *
 * Why: the overlay finds fields by position in files without names (D-111); a fixture small enough to read in full
 *      makes each expected position obvious, while the real libraries are covered by the integration tests.
 * Spec: H5P-008, H5P-010
 * Collaborators: ./semanticsPath.test.ts, ./applyLanguageOverlay.test.ts, ./LanguageOverlayLibraryStorage.test.ts.
 * Tests: these fixtures are themselves test data.
 */
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

/** `H5P.Fixture 1.0`'s semantics. */
export const FIXTURE_SEMANTICS: ISemanticsEntry[] = [
  { name: 'question', type: 'text', label: 'Question' },
  {
    name: 'UI',
    type: 'group',
    label: 'User interface',
    fields: [
      { name: 'check', type: 'text', label: 'Check button label', default: 'Check' },
      { name: 'submit', type: 'text', label: 'Submit button label', default: 'Submit' },
    ],
  },
  {
    name: 'steps',
    type: 'list',
    label: 'Steps',
    field: {
      name: 'step',
      type: 'group',
      label: 'Step',
      fields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'proceed', type: 'text', label: 'Proceed button', default: 'Proceed' },
      ],
    },
  },
  { name: 'video', type: 'video', label: 'Video', description: 'Add a video.' },
  { name: 'tags', type: 'list', label: 'Tags', field: { name: 'tag', type: 'text', default: 'Tag' } },
] as ISemanticsEntry[];

/** Its `language/nb.json`: Bokmål where H5P has it, English elsewhere, positional and partly missing. */
export const FIXTURE_NB = {
  semantics: [
    { label: 'Spørsmål' },
    { label: 'Brukergrensesnitt', fields: [{ label: 'Sjekk-knapp', default: 'Sjekk' }] },
  ],
  libraryStrings: { paste: 'Paste', copy: 'Kopier' },
};

/** Its `language/en.json`: only library strings. */
export const FIXTURE_EN = { libraryStrings: { paste: 'Paste', copy: 'Copy' } };
