/**
 * overlaidLanguageFile — reads what HVL's overlay needs from a library storage (the language file H5P ships, the
 * library's semantics and its English library strings) and returns that language file with the overlay laid over it.
 *
 * Why: the storage wrapper (../storage/LanguageOverlayLibraryStorage.ts) answers Lumi's reads; the reading and merging
 *      behind one overlaid file live here, so the wrapper stays a list of pass-throughs (D-111).
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - It only reads from the storage it is given, through `fileExists`, `getFileAsString` and `getFileAsJson`.
 *   - The file starts from what Lumi would otherwise serve: nn.json, else nb.json (D-046), else the English file
 *     (`en.json`, then H5P's template `.en.json`), so no key the library has is ever dropped; `{}` only when the
 *     library has no language file at all.
 *   - The result is a new object (./applyLanguageOverlay.ts); nothing the storage returned is changed. When no edit
 *     applies there is no result, so a library the overlay does not fit is served exactly as before.
 * Collaborators: ./applyLanguageOverlay.ts, ../storage/LanguageOverlayLibraryStorage.ts,
 *   ../storage/LanguageFallbackLibraryStorage.ts (the file names).
 * Tests: apps/server/test/h5p/languageOverlay/LanguageOverlayLibraryStorage.test.ts
 */
import type { ILibraryName, ILibraryStorage } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { BOKMAAL_LANGUAGE_FILE, NYNORSK_LANGUAGE_FILE } from '../storage/LanguageFallbackLibraryStorage.js';
import { applyLanguageOverlay } from './applyLanguageOverlay.js';
import type { OverlayEdit } from './languageOverlay.js';

/** Where a library keeps its English library strings: `en.json`, or H5P's template `.en.json`. */
const ENGLISH_LANGUAGE_FILES = ['language/en.json', 'language/.en.json'];

const optionalJson = async (storage: ILibraryStorage, library: ILibraryName, file: string) =>
  (await storage.fileExists(library, file)) ? storage.getFileAsJson(library, file) : undefined;

/** The file Lumi would serve without the overlay: nn.json, else nb.json (D-046), else English; `{}` when none. */
async function shippedFile(storage: ILibraryStorage, library: ILibraryName, file: string): Promise<unknown> {
  const own = file === NYNORSK_LANGUAGE_FILE ? [file, BOKMAAL_LANGUAGE_FILE] : [file];
  for (const candidate of [...own, ...ENGLISH_LANGUAGE_FILES])
    if (await storage.fileExists(library, candidate))
      return JSON.parse(await storage.getFileAsString(library, candidate)) as unknown;
  return {};
}

async function englishStrings(
  storage: ILibraryStorage,
  library: ILibraryName,
): Promise<Record<string, unknown> | undefined> {
  for (const file of ENGLISH_LANGUAGE_FILES) {
    const english = (await optionalJson(storage, library, file)) as { libraryStrings?: unknown } | undefined;
    const strings = english?.libraryStrings;
    if (typeof strings === 'object' && strings !== null) return strings as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Reads one of a library's language files with the overlay's edits laid over it.
 * @param storage - D-046's storage (the language fallback over the cached library storage).
 * @param library - The library being read.
 * @param file - `language/nn.json` or `language/nb.json`.
 * @param edits - The overlay's edits for this library version and language.
 * @returns A new language file: H5P's own keys, `libraryStrings` included, with HVL's texts; undefined when no
 *   edit applies (each names a field or string the library lacks, or a changed English text), so the caller serves
 *   the library's own answer.
 * @spec H5P-008
 */
export async function readOverlaidLanguageFile(
  storage: ILibraryStorage,
  library: ILibraryName,
  file: string,
  edits: readonly OverlayEdit[],
): Promise<Record<string, unknown> | undefined> {
  const [base, semantics, strings] = await Promise.all([
    shippedFile(storage, library, file),
    optionalJson(storage, library, 'semantics.json'),
    edits.some((edit) => edit.kind === 'libraryString') ? englishStrings(storage, library) : undefined,
  ]);
  const overlaid = applyLanguageOverlay(base, edits, {
    semantics: Array.isArray(semantics) ? (semantics as ISemanticsEntry[]) : undefined,
    englishStrings: strings,
  });
  return overlaid.skipped.length === edits.length ? undefined : overlaid.file;
}
