/**
 * h5pTextsFixture — writes a content folder with `h5p-tekstar/` files for the H5P texts tests, small valid ones by
 * default, with any file replaced or left out.
 *
 * Why: the loader and `content:check` must refuse each kind of broken file by file, line and key (D-111, D-082);
 *      each test changes one file of an otherwise valid folder.
 * Spec: H5P-008, H5P-010
 * Collaborators: ./h5pTextsContent.test.ts, ./h5pTextsLibraryChecks.test.ts.
 * Tests: this fixture is itself test data.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A valid Nynorsk file with one default, one label and one library string. */
export const VALID_NN = `status: draft
libraries:
  H5P.Fixture 1.0:
    defaults:
      UI.submit:
        en: "Submit"
        nn: "Send inn"
    labels:
      UI.submit:
        en: "Submit button label"
        nn: "Namn på «Send inn»-knappen"
    libraryStrings:
      paste:
        en: "Paste"
        nn: "Lim inn"
`;

/** A valid Bokmål file with one default. */
export const VALID_NB = `status: reviewed
libraries:
  H5P.Fixture 1.0:
    defaults:
      steps[].proceed:
        en: "Proceed"
        nb: "Gå videre"
`;

/** Valid video guidance on the fixture's video field. */
export const VALID_GUIDANCE = `status: draft
description:
  nn: "Bruk Panopto."
  nb: "Bruk Panopto."
  en: "Use Panopto."
fields:
  - library: H5P.Fixture 1.0
    field: video
`;

/** The three files by name; `null` leaves a file out. */
export type H5pTextsFiles = Partial<Record<'nn' | 'nb' | 'guidance', string | null>>;

/**
 * Writes a content folder holding only `h5p-tekstar/`.
 * @param files - Replacements for the valid files; `null` leaves one out.
 * @returns The content folder.
 */
export function h5pTextsRoot(files: H5pTextsFiles = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'hvli-h5p-texts-'));
  mkdirSync(join(root, 'h5p-tekstar'));
  const all = { nn: VALID_NN, nb: VALID_NB, guidance: VALID_GUIDANCE, ...files };
  const names = { nn: 'library-texts.nn.yaml', nb: 'library-texts.nb.yaml', guidance: 'video-guidance.yaml' };
  for (const [key, text] of Object.entries(all))
    if (text !== null) writeFileSync(join(root, 'h5p-tekstar', names[key as keyof typeof names]), text);
  return root;
}
