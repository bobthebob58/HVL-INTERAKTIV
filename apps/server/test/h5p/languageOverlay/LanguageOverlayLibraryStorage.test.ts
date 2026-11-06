/**
 * Tests for LanguageOverlayLibraryStorage through Lumi's own LibraryManager: Nynorsk and Bokmål language files carry
 * HVL's texts on top of what H5P ships (nn starting from nb.json when nn.json is missing), English and every other
 * file stay as they are, and the cached files below are never changed. The pinned real libraries with the texts in
 * `content/h5p-tekstar/` show the same for MultiChoice and DragNBar.
 *
 * Spec: H5P-008, H5P-010
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  fsImplementations,
  LibraryManager,
  LibraryName,
  type ILibraryStorage,
} from '@lumieducation/h5p-server';
import type { LanguageOverlay } from '../../../src/h5p/languageOverlay/languageOverlay.js';
import { withLanguageFallback } from '../../../src/h5p/storage/LanguageFallbackLibraryStorage.js';
import { withLanguageOverlay } from '../../../src/h5p/storage/LanguageOverlayLibraryStorage.js';
import { createLibraryStorage } from '../../../src/h5p/storage/libraryStorageFactory.js';
import { loadLanguageOverlay } from '../../../src/learningDesign/content/h5pTextsContent.js';
import { PINNED_LIBRARIES_DIR } from '../../../src/learningDesign/content/installedLibraries.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { FIXTURE_EN, FIXTURE_NB, FIXTURE_SEMANTICS } from './overlayFixtures.js';

const FIXTURE = new LibraryName('H5P.Fixture', 1, 0);
const BARE = new LibraryName('H5P.Bare', 1, 0); // semantics and en.json only

const root = mkdtempSync(join(tmpdir(), 'h5p-overlay-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function writeLibrary(name: LibraryName, files: Record<string, unknown>): void {
  const folder = join(root, `${name.machineName}-${name.majorVersion}.${name.minorVersion}`);
  mkdirSync(join(folder, 'language'), { recursive: true });
  const metadata = {
    title: name.machineName,
    machineName: name.machineName,
    majorVersion: 1,
    minorVersion: 0,
  };
  writeFileSync(join(folder, 'library.json'), JSON.stringify({ ...metadata, patchVersion: 0, runnable: 1 }));
  for (const [file, value] of Object.entries(files)) writeFileSync(join(folder, file), JSON.stringify(value));
}
writeLibrary(FIXTURE, {
  'semantics.json': FIXTURE_SEMANTICS,
  'language/nb.json': FIXTURE_NB,
  'language/en.json': FIXTURE_EN,
});
writeLibrary(BARE, { 'semantics.json': FIXTURE_SEMANTICS, 'language/en.json': FIXTURE_EN });

const OVERLAY: LanguageOverlay = {
  edits: {
    'H5P.Fixture 1.0': {
      nn: [
        { kind: 'field', property: 'default', path: 'UI.submit', text: 'Send inn', english: 'Submit' },
        { kind: 'libraryString', key: 'paste', text: 'Lim inn', english: 'Paste' },
      ],
      nb: [
        {
          kind: 'field',
          property: 'label',
          path: 'UI.submit',
          text: 'Send inn-knapp',
          english: 'Submit button label',
        },
      ],
    },
    'H5P.Bare 1.0': {
      nn: [{ kind: 'field', property: 'default', path: 'UI.check', text: 'Sjekk', english: 'Check' }],
    },
  },
};

const cached = createLibraryStorage(root);
const stack = (overlay: LanguageOverlay): ILibraryStorage =>
  withLanguageOverlay(withLanguageFallback(cached), overlay);
const manager = new LibraryManager(stack(OVERLAY));
const parsed = async (library: LibraryName, language: string) =>
  JSON.parse((await manager.getLanguage(library, language)) ?? 'null') as {
    semantics?: { fields?: { default?: string; label?: string }[] }[];
    libraryStrings?: Record<string, string>;
  };

describe('[H5P-008] LanguageOverlayLibraryStorage', () => {
  it('[H5P-008] nn starts from nb.json when the library has no nn.json and gets the nn texts, keeping every key', async () => {
    // Act
    const nn = await parsed(FIXTURE, 'nn');
    // Assert
    expect(nn.semantics?.[1]?.fields).toEqual([
      { label: 'Sjekk-knapp', default: 'Sjekk' },
      { default: 'Send inn' },
    ]);
    expect(nn.semantics?.[0]).toEqual({ label: 'Spørsmål' });
    expect(nn.libraryStrings).toEqual({ paste: 'Lim inn', copy: 'Kopier' });
  });

  it('[H5P-008] nb gets the nb texts only, and en is the file H5P ships', async () => {
    // Act
    const nb = await parsed(FIXTURE, 'nb');
    const en = await manager.getLanguage(FIXTURE, 'en');
    // Assert
    expect(nb.semantics?.[1]?.fields?.[1]).toEqual({ label: 'Send inn-knapp' });
    expect(nb.libraryStrings).toEqual(FIXTURE_NB.libraryStrings);
    expect(JSON.parse(en ?? 'null')).toEqual(FIXTURE_EN);
  });

  it('[H5P-008] a library with neither nn.json nor nb.json starts from its English file; without an entry Lumi serves that', async () => {
    // Act
    const bare = await parsed(BARE, 'nn');
    const withoutOverlay = await new LibraryManager(stack({ edits: {} })).getLanguage(BARE, 'nn');
    // Assert
    expect(bare).toEqual({ ...FIXTURE_EN, semantics: [{}, { fields: [{ default: 'Sjekk' }] }] });
    expect(JSON.parse(withoutOverlay ?? 'null')).toEqual(FIXTURE_EN);
  });

  it('[H5P-008] serves the library’s own answer when no entry applies (a field it lacks, a changed English text)', async () => {
    // Arrange
    const stale: LanguageOverlay = {
      edits: {
        'H5P.Fixture 1.0': {
          nb: [{ kind: 'field', property: 'default', path: 'UI.submit', text: 'Send', english: 'Send' }],
        },
        'H5P.Bare 1.0': {
          nn: [{ kind: 'field', property: 'default', path: 'UI.cancel', text: 'Avbryt', english: 'Cancel' }],
        },
      },
    };
    const plain = new LibraryManager(stack({ edits: {} }));
    const staleManager = new LibraryManager(stack(stale));
    // Act and assert
    expect(await staleManager.getLanguage(FIXTURE, 'nb')).toBe(await plain.getLanguage(FIXTURE, 'nb'));
    expect(await staleManager.getLanguage(BARE, 'nn')).toBe(await plain.getLanguage(BARE, 'nn'));
    await expect(stack(stale).getFileAsString(BARE, 'language/nn.json')).rejects.toThrow();
  });

  it('[H5P-008] passes every other read through and never changes the cached files', async () => {
    // Arrange
    const storage = stack(OVERLAY);
    const before = await cached.getFileAsJson(FIXTURE, 'language/nb.json');
    const copy = structuredClone(before);
    // Act
    const asJson = await storage.getFileAsJson(FIXTURE, 'language/nn.json');
    await storage.getFileAsString(FIXTURE, 'language/nb.json');
    // Assert
    expect(await cached.getFileAsJson(FIXTURE, 'language/nb.json')).toEqual(copy);
    expect(asJson).toEqual(await parsed(FIXTURE, 'nn'));
    expect(await storage.fileExists(FIXTURE, 'language/nn.json')).toBe(false);
    expect(await storage.getFileAsJson(FIXTURE, 'semantics.json')).toEqual(FIXTURE_SEMANTICS);
    expect(await storage.getLanguages(FIXTURE)).toEqual(
      await withLanguageFallback(cached).getLanguages(FIXTURE),
    );
  });
});

describeWithRealPackages('[H5P-008] the overlay on the pinned libraries', () => {
  const pinned = withLanguageFallback(new fsImplementations.FileLibraryStorage(PINNED_LIBRARIES_DIR));
  const real = new LibraryManager(withLanguageOverlay(pinned, loadLanguageOverlay()));
  const unchanged = new LibraryManager(pinned);
  const shipped = (folder: string, file: string) =>
    JSON.parse(readFileSync(join(PINNED_LIBRARIES_DIR, folder, 'language', file), 'utf8')) as {
      semantics?: unknown[];
      libraryStrings?: Record<string, string>;
    };

  it("[H5P-008] MultiChoice's nn texts are Nynorsk, and English is what H5P ships (its semantics)", async () => {
    // Act
    const nn = JSON.parse(
      (await real.getLanguage(new LibraryName('H5P.MultiChoice', 1, 16), 'nn')) ?? '{}',
    ) as {
      semantics: { fields?: { default?: string }[] }[];
    };
    const ui = nn.semantics.find((field) => field.fields?.some((entry) => entry.default === 'Sjekk'));
    const multiChoice = new LibraryName('H5P.MultiChoice', 1, 16);
    // Assert
    expect(ui?.fields?.map((entry) => entry.default)).toContain('Send inn');
    expect(ui?.fields?.map((entry) => entry.default)).not.toContain('Submit');
    expect(await real.getLanguage(multiChoice, 'en')).toEqual(await unchanged.getLanguage(multiChoice, 'en'));
  });

  it("[H5P-008] DragNBar's editor strings are Norwegian in nn and nb, with every key it ships", async () => {
    // Act
    const read = async (language: string) =>
      JSON.parse((await real.getLanguage(new LibraryName('H5P.DragNBar', 1, 5), language)) ?? '{}') as {
        libraryStrings: Record<string, string>;
      };
    const [nn, nb] = [await read('nn'), await read('nb')];
    // Assert
    expect([nn.libraryStrings.paste, nb.libraryStrings.paste]).toEqual(['Lim inn', 'Lim inn']);
    expect(Object.keys(nn.libraryStrings).sort()).toEqual(
      Object.keys(shipped('H5P.DragNBar-1.5', 'nn.json').libraryStrings ?? {}).sort(),
    );
    expect(Object.values(nb.libraryStrings)).not.toContain('Bring to Front');
  });
});
