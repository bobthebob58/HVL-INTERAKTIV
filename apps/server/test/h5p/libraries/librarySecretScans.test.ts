/**
 * Tests for the server's two build-secret scans: the library folders of a package (seed and admin import) and an
 * installed library folder (the re-seed check); the refusal names library, file and variables, never a value, and
 * maps to 400 with its own message in nn, nb and en. The ten real packages and this machine's library folder pass.
 * Every secret here is made up (D-110 amendment of 2026-11-06).
 *
 * Spec: H5P-003, H5P-011
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  assertInstalledLibrariesClean,
  scanInstalledLibraries,
} from '../../../src/h5p/libraries/installedLibraryScan.js';
import {
  LibrarySecretsFoundError,
  TOO_LARGE_TO_SCAN,
} from '../../../src/h5p/libraries/librarySecretFindings.js';
import { buildSecretsIn } from '../../../src/h5p/libraries/libraryBuildSecrets.js';
import {
  assertNoLibrarySecrets,
  librarySecretsInPackage,
} from '../../../src/h5p/libraries/packageSecretScan.js';
import { toErrorResponse } from '../../../src/http/h5pErrorResponse.js';
import { LOCALES, t } from '../../../src/i18n/translate.js';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { MULTI_CHOICE } from '../../support/tenTypeLibraries.js';

const VALUE = 'doNotPrintMe-x1';
/** This machine's library folder, seeded by `npm run seed:libraries` (absent in CI, which seeds none there). */
const LIBRARY_DIR = fileURLToPath(new URL('../../../var/h5p/libraries', import.meta.url));
const LEAK = `var e={PATH:"/usr/bin",HOME:"/h",npm_package_name:"x",GH_TOKEN:"${VALUE}"};`;
/** A programming lesson that quotes a made-up key, as an author may write one. */
const LESSON = { question: 'Sjå på koden: {GH_TOKEN:"abc"}', answers: ['Ho loggar inn'] };
const folders: string[] = [];
const tempFolder = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'hvli-libs-'));
  folders.push(dir);
  return dir;
};
afterAll(() => {
  removeBuiltPackages();
  folders.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('[H5P-003] the build-secret scan of a package', () => {
  it('[H5P-003] names the library folder, the file and the variables of a leaky library, never the value', async () => {
    // Arrange: a clean main library and a dependency whose build dumped its environment.
    const leaky = { machineName: 'H5P.LeakProbe', files: { 'dist/probe.js': LEAK } };
    const path = await buildH5pPackage({ main: MULTI_CHOICE, libraries: [leaky] });
    // Act
    const findings = await librarySecretsInPackage(path);
    const refusal = await assertNoLibrarySecrets(path).catch((e: unknown) => e);
    // Assert
    expect(findings).toEqual([{ library: 'H5P.LeakProbe-1.0', file: 'dist/probe.js', names: ['GH_TOKEN'] }]);
    expect(refusal).toBeInstanceOf(LibrarySecretsFoundError);
    expect((refusal as Error).message).toContain('H5P.LeakProbe-1.0/dist/probe.js holds GH_TOKEN');
    expect(JSON.stringify(refusal) + (refusal as Error).message).not.toContain(VALUE);
  });

  it('[H5P-003] leaves content/ alone, though the same text in a library file is a finding', async () => {
    // Arrange: a programming lesson that quotes a key, once as the content and once as a library's file.
    const lessonFile = { 'lesson.json': JSON.stringify(LESSON) };
    expect(buildSecretsIn(JSON.stringify(LESSON)), 'the rules flag the lesson text').toEqual(['GH_TOKEN']);
    // Act
    const asContent = await librarySecretsInPackage(
      await buildH5pPackage({ main: MULTI_CHOICE, params: LESSON }),
    );
    const asLibrary = await librarySecretsInPackage(
      await buildH5pPackage({ main: { ...MULTI_CHOICE, files: lessonFile } }),
    );
    // Assert
    expect(asContent).toEqual([]);
    expect(asLibrary).toEqual([
      { library: 'H5P.MultiChoice-1.16', file: 'lesson.json', names: ['GH_TOKEN'] },
    ]);
  });

  it('[H5P-003] refuses a library text file too large to scan', async () => {
    // Arrange: a 33 MB script that compresses to almost nothing.
    const big = { machineName: 'H5P.BigProbe', files: { 'big.js': ' '.repeat(33 * 1024 * 1024) } };
    // Act
    const tooLarge = await librarySecretsInPackage(
      await buildH5pPackage({ main: MULTI_CHOICE, libraries: [big] }),
    );
    // Assert
    expect(tooLarge).toEqual([{ library: 'H5P.BigProbe-1.0', file: 'big.js', names: [TOO_LARGE_TO_SCAN] }]);
  });

  it('[H5P-011] the refusal is a 400 with the library folders, in nn, nb and en', () => {
    // Arrange
    const error = new LibrarySecretsFoundError(
      [{ library: 'H5P.LeakProbe-1.0', file: 'dist/probe.js', names: ['GH_TOKEN'] }],
      'nothing was installed',
    );
    for (const locale of LOCALES) {
      // Act
      const { status, body } = toErrorResponse(error, locale);
      // Assert
      expect(status).toBe(400);
      expect(body.errorCode).toBe('upload.package.librarySecrets');
      expect(body.message).toBe(
        t('upload.package.librarySecrets', { libraries: 'H5P.LeakProbe-1.0' }, locale),
      );
      expect(body.message).toContain('H5P.LeakProbe-1.0');
    }
  });
});

describe('[H5P-003] the build-secret scan of an installed library folder', () => {
  it('[H5P-003] names each leaky library folder and nested file, and follows no symbolic link', async () => {
    // Arrange: a clean library, a leaky one with a nested file, and a link to a leaky file outside.
    const dir = tempFolder();
    const outside = join(tempFolder(), 'outside.js');
    writeFileSync(outside, LEAK);
    mkdirSync(join(dir, 'H5P.Clean-1.0', 'js'), { recursive: true });
    writeFileSync(join(dir, 'H5P.Clean-1.0', 'js', 'main.js'), 'var labels={OK:"Riktig"};');
    symlinkSync(outside, join(dir, 'H5P.Clean-1.0', 'js', 'linked.js'));
    mkdirSync(join(dir, 'H5P.AudioRecorder-1.0', 'dist'), { recursive: true });
    writeFileSync(join(dir, 'H5P.AudioRecorder-1.0', 'dist', 'h5p-audio-recorder.js'), LEAK);
    writeFileSync(join(dir, 'H5P.AudioRecorder-1.0', 'library.json'), '{"machineName":"H5P.AudioRecorder"}');
    // Act
    const scan = await scanInstalledLibraries(dir);
    const refusal = await assertInstalledLibrariesClean(dir).catch((e: unknown) => e);
    // Assert
    expect(scan).toEqual({
      libraries: 2,
      findings: [
        { library: 'H5P.AudioRecorder-1.0', file: 'dist/h5p-audio-recorder.js', names: ['GH_TOKEN'] },
      ],
    });
    expect(refusal).toBeInstanceOf(LibrarySecretsFoundError);
    expect((refusal as Error).message).toMatch(/delete each library folder named here/);
    expect((refusal as Error).message).not.toContain(VALUE);
  });

  it('[H5P-003] a clean library folder passes and reports how many library folders it scanned', async () => {
    const dir = tempFolder();
    mkdirSync(join(dir, 'H5P.Clean-1.0'));
    writeFileSync(join(dir, 'H5P.Clean-1.0', 'library.json'), '{"machineName":"H5P.Clean"}');
    expect(await assertInstalledLibrariesClean(dir)).toBe(1);
  });
});

describeWithRealPackages('[H5P-003] the real content types pass the build-secret scan', () => {
  it('[H5P-003] the library files of all ten real packages hold no build secrets', async () => {
    for (const name of ['Blanks', 'BranchingScenario', 'Column', 'CoursePresentation', 'DragText'])
      expect(await librarySecretsInPackage(join(REAL_PACKAGES_DIR, `H5P.${name}.h5p`)), name).toEqual([]);
    for (const name of ['ImageHotspots', 'InteractiveBook', 'InteractiveVideo', 'MultiChoice', 'QuestionSet'])
      expect(await librarySecretsInPackage(join(REAL_PACKAGES_DIR, `H5P.${name}.h5p`)), name).toEqual([]);
  }, 60_000);

  it.skipIf(!existsSync(LIBRARY_DIR))(
    '[H5P-003] this machine’s installed library folder, seeded from them, holds no build secrets',
    async () => {
      expect((await scanInstalledLibraries(LIBRARY_DIR)).findings).toEqual([]);
    },
    60_000,
  );
});
