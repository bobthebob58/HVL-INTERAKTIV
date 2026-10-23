/**
 * LanguageFallbackLibraryStorage — serves a library's Bokmål strings when it has no Nynorsk language file.
 *
 * Why: H5P-008 asks that a content type without `language/nn.json` is shown in Bokmål, then English.
 *      Lumi's LibraryManager falls back from nn straight to en, and its `alterLibraryLanguageFile` hook
 *      cannot supply a missing file (D-046). Lumi reads language files only through this storage:
 *      `LibraryManager.getLanguageWithoutFallback` calls `getFileAsString(library, 'language/<code>.json')`
 *      (used by `getLanguage`, hence by H5PEditor `getLibraryData`, `listAssets` and
 *      `listLibraryLanguageFiles`), and `LibraryManager.listLanguages` calls `getLanguages(library)`
 *      (the `languages` list in H5PEditor `getLibraryData`).
 * Spec: H5P-008
 * Invariants:
 *   - A read of `language/nn.json` returns `language/nb.json` only when nn.json does not exist and nb.json
 *     does. When neither exists, the original "missing file" error reaches Lumi, which then falls back to en.
 *   - `getLanguages` adds `nn` when a library lists `nb` but not `nn`, so the editor's language switcher
 *     offers and selects Nynorsk (it only lists codes the libraries report).
 *   - Every other method, and `fileExists`/`getFileStream`/`getFileStats`/`listFiles` for language files,
 *     is passed through unchanged: exports, consistency checks and installs see the library as it is.
 * Collaborators: wraps the storage from ./libraryStorageFactory.ts (outside the cache, so the extra
 *   `fileExists` calls are cached); used by the editor and player factories.
 * Tests: apps/server/test/h5p/LanguageFallbackLibraryStorage.test.ts
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

/** The file Lumi reads for Nynorsk (LibraryManager lower-cases the code and strips a region first). */
export const NYNORSK_LANGUAGE_FILE = 'language/nn.json';
/** The file served in its place when a library has no Nynorsk translation. */
export const BOKMAAL_LANGUAGE_FILE = 'language/nb.json';

/**
 * A library storage that lets a library without Nynorsk strings fall back to Bokmål (nn → nb).
 * Construct it with `withLanguageFallback`.
 */
export class LanguageFallbackLibraryStorage implements ILibraryStorage {
  /** Present exactly when the wrapped storage has it; Lumi checks for the method before calling it. */
  readonly listAddons?: () => Promise<ILibraryMetadata[]>;

  /**
   * @param inner - The storage that holds the libraries.
   */
  constructor(private readonly inner: ILibraryStorage) {
    const listAddons = inner.listAddons?.bind(inner);
    if (listAddons) this.listAddons = listAddons;
  }

  /**
   * Reads a library file as text; `language/nn.json` falls back to nb, then to the original request.
   * @param library - The library.
   * @param file - Path inside the library.
   * @returns The file's text.
   */
  async getFileAsString(library: ILibraryName, file: string): Promise<string> {
    return this.inner.getFileAsString(library, await this.fileToRead(library, file));
  }

  /**
   * Reads a library file as JSON, with the same language fallback as `getFileAsString`.
   * @param library - The library.
   * @param file - Path inside the library.
   * @returns The parsed file.
   */
  // WHY: Lumi reads language files as strings, but a JSON read of nn.json must give the same answer.
  async getFileAsJson(library: ILibraryName, file: string): Promise<unknown> {
    return this.inner.getFileAsJson(library, await this.fileToRead(library, file));
  }

  async getLanguages(library: ILibraryName): Promise<string[]> {
    const languages = await this.inner.getLanguages(library);
    // WHY: a new array, because Lumi's listLanguages appends 'en' to what it receives and the cached
    // storage below would otherwise keep that change.
    return languages.includes('nb') && !languages.includes('nn') ? [...languages, 'nn'] : [...languages];
  }

  /**
   * The file to read for a request: nb.json in place of a missing nn.json, otherwise the file asked for.
   * @param library - The library being read.
   * @param file - The path Lumi asked for, relative to the library folder.
   * @returns The path to read.
   */
  private async fileToRead(library: ILibraryName, file: string): Promise<string> {
    if (file !== NYNORSK_LANGUAGE_FILE) return file;
    if (await this.inner.fileExists(library, NYNORSK_LANGUAGE_FILE)) return file;
    return (await this.inner.fileExists(library, BOKMAAL_LANGUAGE_FILE)) ? BOKMAAL_LANGUAGE_FILE : file;
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
 * Wraps a library storage so that Lumi shows a library without `language/nn.json` in Bokmål (D-046).
 * @param storage - The library storage to wrap (in production, the cached storage from libraryStorageFactory).
 * @returns A storage with the same libraries whose Nynorsk language reads fall back to Bokmål.
 * @spec H5P-008
 */
export function withLanguageFallback(storage: ILibraryStorage): ILibraryStorage {
  return new LanguageFallbackLibraryStorage(storage);
}
