/**
 * LanguageOverlayLibraryStorage — serves a library's Nynorsk and Bokmål language files with HVL's texts laid over
 * them (`content/h5p-tekstar/`), and every other file as it is.
 *
 * Why: the editor fills a new activity with the defaults of each library's language file, and many `nn` and `nb`
 *      files leave them in English (S5 probe P1). Lumi's `alterLibraryLanguageFile` hook cannot help: in 10.0.4 it
 *      makes every language file `{ semantics }` only, so the editor libraries lose their `libraryStrings`. Lumi
 *      reads language files only through `ILibraryStorage.getFileAsString` (`LibraryManager
 *      .getLanguageWithoutFallback`), so this wrapper sets the texts there instead (D-111).
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - Only `language/nn.json` and `language/nb.json` of a library version the overlay names are changed, and only
 *     when at least one of its entries applies; every other read, and `fileExists`, `getFileStream`, `getFileStats`
 *     and `listFiles` for those files too, is passed through, so exports, consistency checks and installs see the
 *     library as it is.
 *   - It wraps D-046's storage: `nn` starts from nb.json when the library has no nn.json, and a library with neither
 *     starts from its English file, so every key it has is kept; without an overlay entry the inner storage's answer,
 *     error included, reaches Lumi unchanged.
 *   - Each read builds a new file from what the inner storage returns; the cached objects below are never changed.
 *   - Stored content is never touched: only the editor's form and new activities' defaults change.
 * Collaborators: ./LanguageFallbackLibraryStorage.ts (inside it), ../languageOverlay/overlaidLanguageFile.ts,
 *   ../H5pEditorFactory.ts and ../H5pPlayerFactory.ts (which wrap their storage with it).
 * Tests: apps/server/test/h5p/languageOverlay/LanguageOverlayLibraryStorage.test.ts
 */
import type { Readable } from 'node:stream';
import type {
  IAdditionalLibraryMetadata,
  IFileStats,
  IInstalledLibrary,
  ILibraryMetadata,
  ILibraryName,
  ILibraryStorage,
} from '@lumieducation/h5p-server';
import {
  overlayEditsFor,
  type LanguageOverlay,
  type OverlayLanguage,
} from '../languageOverlay/languageOverlay.js';
import { readOverlaidLanguageFile } from '../languageOverlay/overlaidLanguageFile.js';
import { BOKMAAL_LANGUAGE_FILE, NYNORSK_LANGUAGE_FILE } from './LanguageFallbackLibraryStorage.js';

const OVERLAID_FILES: ReadonlyMap<string, OverlayLanguage> = new Map([
  [NYNORSK_LANGUAGE_FILE, 'nn'],
  [BOKMAAL_LANGUAGE_FILE, 'nb'],
]);

/** A library storage whose Nynorsk and Bokmål language files carry HVL's texts. Build it with `withLanguageOverlay`. */
export class LanguageOverlayLibraryStorage implements ILibraryStorage {
  /** Present exactly when the wrapped storage has it; Lumi checks for the method before calling it. */
  readonly listAddons?: () => Promise<ILibraryMetadata[]>;

  /**
   * @param inner - D-046's storage (the language fallback over the cached library storage).
   * @param overlay - The texts loaded from `content/h5p-tekstar/`.
   */
  constructor(
    private readonly inner: ILibraryStorage,
    private readonly overlay: LanguageOverlay,
  ) {
    const listAddons = inner.listAddons?.bind(inner);
    if (listAddons) this.listAddons = listAddons;
  }

  /**
   * Reads a library file as text; a Nynorsk or Bokmål language file the overlay names gets HVL's texts.
   * @param library - The library.
   * @param file - Path inside the library.
   * @returns The file's text (JSON for an overlaid language file).
   */
  async getFileAsString(library: ILibraryName, file: string): Promise<string> {
    const overlaid = await this.overlaid(library, file);
    return overlaid ? JSON.stringify(overlaid) : this.inner.getFileAsString(library, file);
  }

  /**
   * Reads a library file as JSON, with the same overlay as `getFileAsString`.
   * @param library - The library.
   * @param file - Path inside the library.
   * @returns The parsed file (a new object for an overlaid language file).
   */
  async getFileAsJson(library: ILibraryName, file: string): Promise<unknown> {
    return (await this.overlaid(library, file)) ?? this.inner.getFileAsJson(library, file);
  }

  // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/LibraryManager.ts
  // (getLanguageWithoutFallback): once set, Lumi 10.0.4's `alterLibraryLanguageFile` hook returns only `{ semantics }`,
  // so this wrapper does that hook's work. No issue is filed yet; the draft is docs/upstream/lumi-alter-language-file.md
  // (D-112). Once a Lumi release keeps every key, this can become that hook; the texts stay in content/ (D-111).
  /** The overlaid file, or undefined when it is not a Norwegian language file or no overlay entry applies. */
  private async overlaid(library: ILibraryName, file: string): Promise<unknown> {
    const language = OVERLAID_FILES.get(file);
    const edits = language ? overlayEditsFor(this.overlay, library, language) : [];
    return edits.length > 0 ? readOverlaidLanguageFile(this.inner, library, file, edits) : undefined;
  }

  addFile(library: ILibraryName, filename: string, readStream: Readable): Promise<boolean> {
    return this.inner.addFile(library, filename, readStream);
  }

  addLibrary(libraryData: ILibraryMetadata, restricted: boolean): Promise<IInstalledLibrary> {
    return this.inner.addLibrary(libraryData, restricted);
  }

  clearFiles(library: ILibraryName): Promise<void> {
    return this.inner.clearFiles(library);
  }

  deleteLibrary(library: ILibraryName): Promise<void> {
    return this.inner.deleteLibrary(library);
  }

  fileExists(library: ILibraryName, filename: string): Promise<boolean> {
    return this.inner.fileExists(library, filename);
  }

  getAllDependentsCount(): Promise<{ [ubername: string]: number }> {
    return this.inner.getAllDependentsCount();
  }

  getDependentsCount(library: ILibraryName): Promise<number> {
    return this.inner.getDependentsCount(library);
  }

  getFileStats(library: ILibraryName, file: string): Promise<IFileStats> {
    return this.inner.getFileStats(library, file);
  }

  getFileStream(library: ILibraryName, file: string): Promise<Readable> {
    return this.inner.getFileStream(library, file);
  }

  getInstalledLibraryNames(machineName?: string): Promise<ILibraryName[]> {
    return this.inner.getInstalledLibraryNames(machineName);
  }

  getLanguages(library: ILibraryName): Promise<string[]> {
    return this.inner.getLanguages(library);
  }

  getLibrary(library: ILibraryName): Promise<IInstalledLibrary> {
    return this.inner.getLibrary(library);
  }

  isInstalled(library: ILibraryName): Promise<boolean> {
    return this.inner.isInstalled(library);
  }

  listFiles(library: ILibraryName): Promise<string[]> {
    return this.inner.listFiles(library);
  }

  updateAdditionalMetadata(
    library: ILibraryName,
    additionalMetadata: Partial<IAdditionalLibraryMetadata>,
  ): Promise<boolean> {
    return this.inner.updateAdditionalMetadata(library, additionalMetadata);
  }

  updateLibrary(libraryMetadata: ILibraryMetadata): Promise<IInstalledLibrary> {
    return this.inner.updateLibrary(libraryMetadata);
  }
}

/**
 * Wraps D-046's library storage so that Nynorsk and Bokmål language files carry HVL's texts (D-111).
 * @param storage - The storage to wrap: `withLanguageFallback(...)`'s result.
 * @param overlay - The texts loaded from `content/h5p-tekstar/`.
 * @returns A storage with the same libraries whose overlaid language files carry HVL's texts.
 * @spec H5P-008
 */
export function withLanguageOverlay(storage: ILibraryStorage, overlay: LanguageOverlay): ILibraryStorage {
  return new LanguageOverlayLibraryStorage(storage, overlay);
}
