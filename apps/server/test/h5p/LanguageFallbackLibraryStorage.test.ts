/**
 * Tests that a library without Nynorsk strings is shown in Bokmål, then English, through Lumi's real
 * LibraryManager and H5PEditor over the fixture libraries in test/fixtures/h5p-libraries.
 *
 * Spec: H5P-008
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  fsImplementations,
  H5PEditor,
  LibraryManager,
  LibraryName,
  type ILibraryStorage,
  type IPermissionSystem,
} from '@lumieducation/h5p-server';
import { createH5pConfig } from '../../src/h5p/H5pConfigFactory.js';
import { createHvlTranslationCallback } from '../../src/h5p/HvlTranslationCallback.js';
import {
  LanguageFallbackLibraryStorage,
  withLanguageFallback,
} from '../../src/h5p/storage/LanguageFallbackLibraryStorage.js';
import { createLibraryStorage } from '../../src/h5p/storage/libraryStorageFactory.js';

const FIXTURES = fileURLToPath(new URL('../fixtures/h5p-libraries', import.meta.url));
const NB_ONLY = new LibraryName('H5P.LanguageFixture', 1, 0); // nb.json + en.json
const WITH_NN = new LibraryName('H5P.LanguageFixtureNn', 1, 0); // nn.json + nb.json + en.json
const EN_ONLY = new LibraryName('H5P.LanguageFixtureEn', 1, 0); // en.json

// The first semantics label tells which file was served: nn "Helsing", nb "Hilsen", en "Greeting".
const labelOf = (languageFile: string | null): string =>
  (JSON.parse(languageFile ?? 'null') as { semantics: { label: string }[] }).semantics[0]?.label ?? '';

const fixtureStorage = (): ILibraryStorage => new fsImplementations.FileLibraryStorage(FIXTURES);
const withFallback = new LibraryManager(withLanguageFallback(fixtureStorage()));

const tempDirs: string[] = [];
afterAll(() => tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('[H5P-008] LanguageFallbackLibraryStorage', () => {
  it('[H5P-008] a library without nn.json is shown in nb', async () => {
    // Lumi alone goes from nn straight to en (D-046); that is why the wrapper exists.
    expect(labelOf(await new LibraryManager(fixtureStorage()).getLanguage(NB_ONLY, 'nn'))).toBe('Greeting');

    expect(labelOf(await withFallback.getLanguage(NB_ONLY, 'nn'))).toBe('Hilsen');
    expect(labelOf(await withFallback.getLanguage(NB_ONLY, 'nn-NO'))).toBe('Hilsen');
    expect(labelOf(await withFallback.getLanguage(NB_ONLY, 'nb'))).toBe('Hilsen');
    expect(labelOf(await withFallback.getLanguage(NB_ONLY, 'en'))).toBe('Greeting');
  });

  it('[H5P-008] without nb it falls back to en', async () => {
    expect(labelOf(await withFallback.getLanguage(EN_ONLY, 'nn'))).toBe('Greeting');
    expect(labelOf(await withFallback.getLanguage(EN_ONLY, 'nb'))).toBe('Greeting');
  });

  it('[H5P-008] a library with nn.json is shown in nn', async () => {
    expect(labelOf(await withFallback.getLanguage(WITH_NN, 'nn'))).toBe('Helsing');
    expect(labelOf(await withFallback.getLanguage(WITH_NN, 'nb'))).toBe('Hilsen');
    expect(labelOf(await withFallback.getLanguage(WITH_NN, 'en'))).toBe('Greeting');
  });

  it('[H5P-008] the editor gets nb strings for a library without nn.json and offers nn', async () => {
    // Arrange: Lumi's own editor over the production storage stack (cache inside, fallback outside).
    const root = mkdtempSync(join(tmpdir(), 'h5p-language-'));
    tempDirs.push(root);
    const denyAll: IPermissionSystem = {
      checkForUserData: async () => false,
      checkForContent: async () => false,
      checkForTemporaryFile: async () => false,
      checkForGeneralAction: async () => false,
    };
    const editor = new H5PEditor(
      new fsImplementations.InMemoryStorage(),
      await createH5pConfig(undefined, { platformVersion: 'test' }),
      withLanguageFallback(createLibraryStorage(FIXTURES)),
      new fsImplementations.FileContentStorage(join(root, 'content')),
      new fsImplementations.DirectoryTemporaryFileStorage(join(root, 'tmp')),
      createHvlTranslationCallback(),
      undefined,
      { permissionSystem: denyAll },
    );

    // Act
    const data = await editor.getLibraryData('H5P.LanguageFixture', '1', '0', 'nn');
    const files = await editor.listLibraryLanguageFiles(
      ['H5P.LanguageFixture 1.0', 'H5P.LanguageFixtureNn 1.0', 'H5P.LanguageFixtureEn 1.0'],
      'nn',
    );

    // Assert
    expect(labelOf(data.language)).toBe('Hilsen');
    expect(data.translations['H5P.LanguageFixture']).toEqual(JSON.parse(data.language ?? 'null'));
    expect([...data.languages].sort()).toEqual(['en', 'nb', 'nn']);
    expect(Object.fromEntries(Object.entries(files).map(([name, file]) => [name, labelOf(file)]))).toEqual({
      'H5P.LanguageFixture 1.0': 'Hilsen',
      'H5P.LanguageFixtureNn 1.0': 'Helsing',
      'H5P.LanguageFixtureEn 1.0': 'Greeting',
    });
    expect(
      [...(await editor.getLibraryData('H5P.LanguageFixtureNn', '1', '0', 'nn')).languages].sort(),
    ).toEqual(['en', 'nb', 'nn']);
    expect((await editor.getLibraryData('H5P.LanguageFixtureEn', '1', '0', 'nn')).languages).toEqual(['en']);
  });

  it('[H5P-008] only a missing nn.json is replaced; the library itself is reported as it is', async () => {
    // Arrange
    const storage = withLanguageFallback(fixtureStorage());

    // Act and assert: the JSON read is redirected; existence, listing and streams stay truthful.
    expect(labelOf(JSON.stringify(await storage.getFileAsJson(NB_ONLY, 'language/nn.json')))).toBe('Hilsen');
    expect(await storage.fileExists(NB_ONLY, 'language/nn.json')).toBe(false);
    expect(await storage.listFiles(NB_ONLY)).not.toContain('language/nn.json');
    await expect(storage.getFileStream(NB_ONLY, 'language/nn.json')).rejects.toThrow('library-file-missing');
    await expect(storage.getFileAsString(NB_ONLY, 'language/de.json')).rejects.toThrow(
      'library-file-missing',
    );
    // Without nb.json, Lumi gets the error for the file it asked for and goes on to en itself.
    await expect(storage.getFileAsString(EN_ONLY, 'language/nn.json')).rejects.toMatchObject({
      errorId: 'library-file-missing',
      replacements: { filename: 'language/nn.json' },
    });
  });

  it('[H5P-008] lists nn next to nb without changing the wrapped list', async () => {
    // Arrange
    const lists: Record<string, string[]> = { nbAndEn: ['nb', 'en'], all: ['nn', 'nb', 'en'], en: ['en'] };
    const inner = { getLanguages: async (lib: LibraryName) => lists[lib.machineName] } as ILibraryStorage;
    const storage = withLanguageFallback(inner);
    const named = (machineName: string) => new LibraryName(machineName, 1, 0);

    // Act and assert
    expect(await storage.getLanguages(named('nbAndEn'))).toEqual(['nb', 'en', 'nn']);
    expect(await storage.getLanguages(named('all'))).toEqual(['nn', 'nb', 'en']);
    expect(await storage.getLanguages(named('en'))).toEqual(['en']);
    (await storage.getLanguages(named('all'))).push('en');
    expect(lists).toEqual({ nbAndEn: ['nb', 'en'], all: ['nn', 'nb', 'en'], en: ['en'] });
  });

  const library = new LibraryName('H5P.Any', 1, 2);
  const metadata = { machineName: 'H5P.Any', majorVersion: 1, minorVersion: 2, patchVersion: 3 };
  const passThrough: [keyof ILibraryStorage, unknown[]][] = [
    ['addFile', [library, 'language/nn.json', Readable.from(['{}'])]],
    ['addLibrary', [metadata, true]],
    ['clearFiles', [library]],
    ['deleteLibrary', [library]],
    ['fileExists', [library, 'language/nn.json']],
    ['getAllDependentsCount', []],
    ['getDependentsCount', [library]],
    ['getFileAsJson', [library, 'semantics.json']],
    ['getFileAsString', [library, 'language/nb.json']],
    ['getFileStats', [library, 'language/nn.json']],
    ['getFileStream', [library, 'language/nn.json']],
    ['getInstalledLibraryNames', ['H5P.Any']],
    ['getLibrary', [library]],
    ['isInstalled', [library]],
    ['listAddons', []],
    ['listFiles', [library]],
    ['updateAdditionalMetadata', [library, { restricted: true }]],
    ['updateLibrary', [metadata]],
  ];

  it.each(passThrough)('[H5P-008] passes %s through unchanged', async (method, args) => {
    // Arrange: a storage whose every method records its call and answers with its own name.
    const calls: unknown[][] = [];
    const inner = new Proxy({} as ILibraryStorage, {
      get:
        (_target, name) =>
        (...received: unknown[]) => {
          calls.push([name, ...received]);
          return Promise.resolve(`answer of ${String(name)}`);
        },
    });
    const wrapped = withLanguageFallback(inner);
    const call = wrapped[method] as (...a: unknown[]) => Promise<unknown>;

    // Act and assert
    expect(await call.apply(wrapped, args)).toBe(`answer of ${method}`);
    expect(calls).toEqual([[method, ...args]]);
  });

  it('[H5P-008] the pass-through table covers every storage method, and listAddons only when present', () => {
    const own = Object.getOwnPropertyNames(LanguageFallbackLibraryStorage.prototype).filter(
      (name) => name !== 'constructor' && name !== 'fileToRead',
    );
    const covered = [...passThrough.map(([method]) => method), 'getLanguages'];

    expect([...own, 'listAddons'].sort()).toEqual([...covered].sort());
    expect(withLanguageFallback({} as ILibraryStorage).listAddons).toBeUndefined();
  });
});
