/**
 * Tests for importing .h5p packages through the editor: content only for authors, audited installs for admins.
 *
 * Spec: SEC-003, SEC-005, H5P-002, H5P-011
 */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256File } from '../../src/h5p/libraries/sha256Sums.js';
import { editorTestbed, removeEditorTestbeds } from '../support/editorTestbed.js';
import { buildH5pPackage, removeBuiltPackages } from '../support/h5pPackageBuilder.js';
import { removeSyntheticLibraryDirs, type SyntheticLibrary } from '../support/syntheticLibraries.js';

afterAll(() => {
  removeEditorTestbeds();
  removeBuiltPackages();
  removeSyntheticLibraryDirs();
});

const MC: SyntheticLibrary = {
  machineName: 'H5P.MultiChoice',
  minorVersion: 16,
  patchVersion: 3,
  runnable: true,
  semantics: [{ name: 'question', type: 'text' }],
};
const MODIFIED_JS = { 'js/main.js': 'window.stolen = document.cookie;' };
const PARAMS = { question: 'Kva er rett?' };

/** The installed library's main script, to prove it was not replaced. */
const installedScript = (libraryDir: string): string =>
  readFileSync(join(libraryDir, 'H5P.MultiChoice-1.16/js/main.js'), 'utf8');

describe('[SEC-003] authors import content, never code', () => {
  it('[SEC-003] refuses a package whose H5P.MultiChoice has another patch version; nothing is installed', async () => {
    const { editor, user, libraryDir } = await editorTestbed([MC]);
    const path = await buildH5pPackage({
      main: { ...MC, patchVersion: 4, files: MODIFIED_JS },
      params: PARAMS,
    });
    await expect(editor.uploadPackage(path, user('author'))).rejects.toMatchObject({
      errorId: 'hvl:package-library-version-mismatch',
      httpStatusCode: 403,
    });
    expect(installedScript(libraryDir)).toBe('/* H5P.MultiChoice */');
    expect(
      (await editor.libraryManager.getLibrary({ ...MC, majorVersion: 1, minorVersion: 16 })).patchVersion,
    ).toBe(3);
  });

  it('[SEC-003] imports only the content when the package carries modified code under the same version', async () => {
    const { editor, user, libraryDir } = await editorTestbed([MC]);
    const path = await buildH5pPackage({ main: { ...MC, files: MODIFIED_JS }, params: PARAMS });
    const result = await editor.uploadPackage(path, user('author'));
    expect(result.parameters).toMatchObject(PARAMS);
    expect(result.installedLibraries).toEqual([]);
    expect(installedScript(libraryDir)).toBe('/* H5P.MultiChoice */');
  });

  it('[SEC-003] refuses a package that needs a library that is not installed, and names it', async () => {
    const { editor, user } = await editorTestbed([MC]);
    const path = await buildH5pPackage({
      main: MC,
      libraries: [{ machineName: 'H5P.Evil', patchVersion: 2 }],
      params: PARAMS,
    });
    await expect(editor.uploadPackage(path, user('author'))).rejects.toMatchObject({
      errorId: 'hvl:package-libraries-not-installed',
      replacements: { libraries: 'H5P.Evil 1.0.2' },
    });
  });

  it('[H5P-002] refuses a package whose main library is not one of the ten', async () => {
    const trueFalse = { machineName: 'H5P.TrueFalse', minorVersion: 8, runnable: true };
    const { editor, user } = await editorTestbed([MC, trueFalse]);
    const path = await buildH5pPackage({ main: trueFalse, omitMainFolder: true });
    await expect(editor.uploadPackage(path, user('author'))).rejects.toMatchObject({
      errorId: 'hvl:content-type-not-allowed',
      httpStatusCode: 403,
    });
  });

  it('[SEC-005] runs the archive checks before Lumi sees the package', async () => {
    const { editor, user } = await editorTestbed([MC]);
    const path = await buildH5pPackage({
      main: MC,
      omitMainFolder: true,
      files: { 'content/x.txt': 'x'.repeat(10) },
    });
    const bomb = await buildH5pPackage({
      main: MC,
      omitMainFolder: true,
      files: { 'content/big.txt': Buffer.alloc(51 * 1024 * 1024) },
    });
    await expect(editor.uploadPackage(path, user('author'))).resolves.toBeDefined();
    await expect(editor.uploadPackage(bomb, user('author'))).rejects.toMatchObject({
      messageKey: 'upload.archive.fileTooLarge',
    });
  });

  it('[SEC-003] refuses buffers, library-only imports and missing users', async () => {
    const { editor, user } = await editorTestbed([MC]);
    const path = await buildH5pPackage({ main: MC, omitMainFolder: true, params: PARAMS });
    await expect(editor.uploadPackage(readFileSync(path), user('author'))).rejects.toMatchObject({
      httpStatusCode: 400,
    });
    await expect(
      editor.uploadPackage(path, user('admin'), { onlyInstallLibraries: true }),
    ).rejects.toMatchObject({ httpStatusCode: 400 });
    await expect(editor.uploadPackage(path)).rejects.toMatchObject({ httpStatusCode: 400 });
  });
});

describe('[H5P-011] admins install library updates through an audited import', () => {
  it('[H5P-011][SEC-003] an admin import installs the newer patch and records actor, source and package hash', async () => {
    const { editor, user, audited } = await editorTestbed([MC]);
    const admin = user('admin');
    const path = await buildH5pPackage({ main: { ...MC, patchVersion: 4 }, params: PARAMS });
    const result = await editor.uploadPackage(path, admin);
    expect(result.installedLibraries).toMatchObject([{ type: 'patch' }]);
    expect(audited).toEqual([
      {
        results: result.installedLibraries,
        change: { source: 'upload', actorUserId: admin.actor.accountId, sha256: await sha256File(path) },
      },
    ]);
  });
});
