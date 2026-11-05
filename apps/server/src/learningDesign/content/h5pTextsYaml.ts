/**
 * h5pTextsYaml — the zod schemas of `content/h5p-tekstar/`: HVL's Nynorsk and Bokmål texts for the H5P libraries
 * (`library-texts.nn.yaml`, `library-texts.nb.yaml`) and `H5P-010`'s video guidance (`video-guidance.yaml`).
 *
 * Why: ALU and HVL's language advisers edit these texts by hand (D-111, D-082). A typo must stop the start with a
 *      message naming the file, line and key, and a text must never carry markup into the editor's page.
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - Schemas are strict: an unknown key is a problem at its own line.
 *   - A library is `Name major.minor`; a field path is the shape ../../h5p/languageOverlay/semanticsPath.ts reads;
 *     a library-string key is a plain identifier, never one that would reach a prototype.
 *   - Every text is trimmed, one line, at most 600 characters and plain: `<` and `>` are refused, because the editor
 *     writes labels, descriptions and library strings into its page as HTML. HVL's own texts (nn, nb and the
 *     guidance) may not hold `"` either: libraries put texts into double-quoted attributes, and a default reaches the
 *     page unescaped (D-111 amendment of 2026-11-05, review). `en` may, since H5P's English labels do and it is
 *     never shown.
 *   - An entry gives `en` (the library's English text) and the text in its file's language, nothing else.
 * Collaborators: ./h5pTextsContent.ts, ./h5pTextsLibraryChecks.ts, ./contentText.ts,
 *   ../../h5p/languageOverlay/semanticsPath.ts.
 * Tests: apps/server/test/learningDesign/content/h5pTextsContent.test.ts
 */
import { z } from 'zod';
import { SEMANTICS_PATH } from '../../h5p/languageOverlay/semanticsPath.js';
import { contentText } from './contentText.js';

/** Whether HVL's language advisers and ALU have reviewed a file (Q2, Q17). */
export const H5P_TEXTS_STATUSES = ['draft', 'reviewed'] as const;

/** The longest text, in characters (the longest guidance is about 400). */
export const H5P_TEXT_MAX_LENGTH = 600;

const LIBRARY_VERSION = /^[A-Za-z][\w.]* \d+\.\d+$/;
const STRING_KEY = /^[A-Za-z][\w-]*$/;
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

// SECURITY: the editor writes labels, descriptions and library strings into its page as HTML (D-111).
const plainText = contentText({ maxLength: H5P_TEXT_MAX_LENGTH }).refine(
  (text) => !/[<>]/.test(text),
  'must not hold < or > (the texts are plain text, not HTML)',
);

// SECURITY: libraries build double-quoted attributes from these texts (DragNBar's `title="' + H5PEditor.t(…) + '"`,
// CoursePresentation's `aria-label="'+this.cp.l10n.…+'"`), and the editor stores a default unescaped where it
// escapes what an author types (h5peditor.js, h5peditor-text.js), so a `"` would end the attribute (D-111).
const ownText = plainText.refine(
  (text) => !text.includes('"'),
  'must not hold " (write «» for quotation marks)',
);

/** `H5P.Name major.minor`, as a key or a value. */
export const libraryVersionText = z
  .string()
  .regex(LIBRARY_VERSION, 'is not a library version (write H5P.Name major.minor, e.g. H5P.MultiChoice 1.16)');

/** A semantics path such as `UI.submitAnswerButton` or `branchingScenario.content[].proceedButtonText`. */
export const fieldPathText = z
  .string()
  .regex(SEMANTICS_PATH, 'is not a field path (field names joined by ".", a list item written name[])');

const stringKey = z
  .string()
  .regex(STRING_KEY, 'is not a library string key (letters, digits, "_" and "-")')
  .refine((key) => !UNSAFE_KEYS.has(key), 'is not a library string key');

const entryOf = <L extends 'nn' | 'nb'>(language: L) =>
  z.strictObject({ en: plainText, [language]: ownText } as { en: typeof plainText } & Record<
    L,
    typeof ownText
  >);

const sectionOf = <L extends 'nn' | 'nb'>(language: L) => {
  const entry = entryOf(language);
  return z.strictObject({
    defaults: z.record(fieldPathText, entry).optional(),
    labels: z.record(fieldPathText, entry).optional(),
    libraryStrings: z.record(stringKey, entry).optional(),
  });
};

/**
 * The schema of `library-texts.<language>.yaml`.
 * @param language - `nn` or `nb`: the key of each entry's translated text.
 * @returns A strict schema of `{ status, libraries }`.
 * @spec H5P-008
 */
export const libraryTextsSchema = <L extends 'nn' | 'nb'>(language: L) =>
  z.strictObject({
    status: z.enum(H5P_TEXTS_STATUSES),
    libraries: z.record(libraryVersionText, sectionOf(language)),
  });

/** One entry of a library-texts file: the English text and its translation under the file's language. */
export type LibraryTextEntry = { readonly en: string } & Readonly<Partial<Record<'nn' | 'nb', string>>>;

/** The parts of one library in a library-texts file. */
export interface LibraryTextsSection {
  readonly defaults?: Readonly<Record<string, LibraryTextEntry>>;
  readonly labels?: Readonly<Record<string, LibraryTextEntry>>;
  readonly libraryStrings?: Readonly<Record<string, LibraryTextEntry>>;
}

/** A loaded library-texts file. */
export interface LibraryTextsFile {
  readonly status: (typeof H5P_TEXTS_STATUSES)[number];
  readonly libraries: Readonly<Record<string, LibraryTextsSection>>;
}

/** The schema of `video-guidance.yaml`: the guidance in three languages and the video fields it goes under. */
export const videoGuidanceSchema = z.strictObject({
  status: z.enum(H5P_TEXTS_STATUSES),
  description: z.strictObject({ nn: ownText, nb: ownText, en: ownText }),
  fields: z
    .array(z.strictObject({ library: libraryVersionText, field: fieldPathText }))
    .min(1, 'must list at least one video field'),
});

/** A loaded `video-guidance.yaml`. */
export type VideoGuidanceFile = z.infer<typeof videoGuidanceSchema>;
