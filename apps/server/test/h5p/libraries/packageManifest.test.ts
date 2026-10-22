/**
 * Tests for reading a package's main library and library versions without extracting it.
 *
 * Spec: SEC-003, H5P-002
 */
import { describe, it, expect, afterAll } from 'vitest';
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { readPackageManifest } from '../../../src/h5p/libraries/packageManifest.js';
import { assertPackageLibrariesInstalled } from '../../../src/h5p/libraries/packageLibraryCheck.js';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(() => {
  removeBuiltPackages();
  removeSyntheticLibraryDirs();
});

const MC = { machineName: 'H5P.MultiChoice', minorVersion: 16, patchVersion: 5, runnable: true };
const QUESTION = { machineName: 'H5P.Question', minorVersion: 5, patchVersion: 2 };

describe('[SEC-003] package manifest', () => {
  it('[SEC-003] reads the main library and every library folder with its patch version', async () => {
    const manifest = await readPackageManifest(await buildH5pPackage({ main: MC, libraries: [QUESTION] }));
    expect(manifest.mainLibrary).toBe('H5P.MultiChoice');
    expect(manifest.mainLibraryVersion).toMatchObject({ majorVersion: 1, minorVersion: 16 });
    expect(manifest.libraries).toEqual(
      expect.arrayContaining([
        { machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16, patchVersion: 5 },
        { machineName: 'H5P.Question', majorVersion: 1, minorVersion: 5, patchVersion: 2 },
      ]),
    );
  });

  it('[SEC-003] lists no libraries for a content-only package', async () => {
    const manifest = await readPackageManifest(await buildH5pPackage({ main: MC, omitMainFolder: true }));
    expect(manifest.libraries).toEqual([]);
  });

  it('[SEC-003] ignores library.json files that are not at the top of a folder', async () => {
    const path = await buildH5pPackage({
      main: MC,
      omitMainFolder: true,
      files: {
        'content/nested/library.json': JSON.stringify({
          machineName: 'H5P.Evil',
          majorVersion: 1,
          minorVersion: 0,
        }),
      },
    });
    expect((await readPackageManifest(path)).libraries).toEqual([]);
  });

  it('[H5P-002] refuses a zip without h5p.json as not an H5P package', async () => {
    await expect(
      readPackageManifest(await buildH5pPackage({ main: MC, omitH5pJson: true })),
    ).rejects.toMatchObject({
      messageKey: 'upload.package.notH5p',
    });
  });
});

describe('[SEC-003] library versions in a package', () => {
  const manager = () =>
    new LibraryManager(new fsImplementations.FileLibraryStorage(syntheticLibraryDir([MC, QUESTION])));

  it('[SEC-003] accepts libraries installed in exactly the same version', async () => {
    await expect(
      assertPackageLibrariesInstalled([{ ...MC, majorVersion: 1, minorVersion: 16 }], manager()),
    ).resolves.toBeUndefined();
  });

  it('[SEC-003] refuses a library installed in another patch version and names it', async () => {
    const modified = { machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16, patchVersion: 6 };
    await expect(assertPackageLibrariesInstalled([modified], manager())).rejects.toMatchObject({
      errorId: 'hvl:package-library-version-mismatch',
      httpStatusCode: 403,
      replacements: { libraries: 'H5P.MultiChoice 1.16.6' },
    });
  });

  it('[SEC-003] refuses libraries that are not installed and names all of them', async () => {
    const libs = [
      { machineName: 'H5P.Evil', majorVersion: 1, minorVersion: 0, patchVersion: 0 },
      { machineName: 'H5P.Question', majorVersion: 1, minorVersion: 6, patchVersion: 0 },
    ];
    await expect(assertPackageLibrariesInstalled(libs, manager())).rejects.toMatchObject({
      errorId: 'hvl:package-libraries-not-installed',
      replacements: { libraries: 'H5P.Evil 1.0.0, H5P.Question 1.6.0' },
    });
  });
});
