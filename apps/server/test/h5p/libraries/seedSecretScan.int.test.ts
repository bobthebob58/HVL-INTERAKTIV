/**
 * Integration tests for the build-secret scan on the seed path: `seedLibraries` refuses a folder with a leaky package
 * before the first install, and the commands operations run (`npm run seed:libraries`, `npm run libraries:check`)
 * exit 1 naming the package, library folder, file and variables, never a value; the seed command also refuses a
 * library folder that still holds an old leaky build, and an archive the zip guard refuses installs nothing even
 * after a clean package (D-110 amendment of 2026-11-06). Every secret is made up.
 *
 * Spec: H5P-003, H5P-011
 */
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaLibraryAuditSink } from '../../../src/h5p/libraries/LibraryAuditSink.js';
import { LibraryInstaller } from '../../../src/h5p/libraries/LibraryInstaller.js';
import { LibrarySecretsFoundError } from '../../../src/h5p/libraries/librarySecretFindings.js';
import { seedLibraries, SHA256SUMS_FILE } from '../../../src/h5p/libraries/seedLibraries.js';
import { sha256File } from '../../../src/h5p/libraries/sha256Sums.js';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed } from '../../support/httpTestbed.js';
import { describeWithServices } from '../../support/services.js';
import { MULTI_CHOICE, QUESTION_SET } from '../../support/tenTypeLibraries.js';

const VALUE = 'doNotPrintMe-x2';
const LEAK = `var e={PATH:"/usr/bin",HOME:"/h",npm_package_name:"x",HTTPS_PROXY:"http://u:${VALUE}@p:3128"};`;
const SERVER_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const REPO_ROOT = join(SERVER_DIR, '../..');
const folders: string[] = [];
const tempFolder = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'hvli-seed-scan-'));
  folders.push(dir);
  return dir;
};

/** A seed folder with the packages and a SHA256SUMS that lists them. */
async function seedFolder(packages: string[]): Promise<string> {
  const dir = tempFolder();
  const lines: string[] = [];
  for (const path of packages) {
    copyFileSync(path, join(dir, basename(path)));
    lines.push(`${await sha256File(path)}  ${basename(path)}\n`);
  }
  writeFileSync(join(dir, SHA256SUMS_FILE), lines.join(''));
  return dir;
}

/** Runs an npm script as operations do (in apps/server, or the root's), with another library folder. */
function runScript(
  script: string,
  args: string[],
  libraryDir: string,
  cwd = SERVER_DIR,
): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, H5P_LIBRARY_DIR: libraryDir };
    const child = spawn('npm', ['run', '--silent', script, '--', ...args], { cwd, env });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out: Buffer.concat(chunks).toString('utf8') }));
  });
}

describeWithServices('the build-secret scan on the seed path', () => {
  let tb: HttpTestbed;
  let installer: LibraryInstaller;
  let clean: string;
  let leaky: string;
  beforeAll(async () => {
    tb = await openHttpTestbed([]);
    installer = new LibraryInstaller(
      tb.runtime.editor.packageImporter,
      new PrismaLibraryAuditSink(tb.db),
      tb.runtime.editor.libraryManager,
    );
    // WHY: the clean package comes first by name, so an install before the scan of every package would show.
    clean = await buildH5pPackage({ main: MULTI_CHOICE }, 'H5P.A-Clean.h5p');
    const recorder = { machineName: 'H5P.RecorderProbe', files: { 'dist/recorder.js': LEAK } };
    leaky = await buildH5pPackage(
      { main: QUESTION_SET, libraries: [MULTI_CHOICE, recorder] },
      'H5P.B-Leaky.h5p',
    );
  }, 60_000);
  afterAll(async () => {
    folders.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
    removeBuiltPackages();
    await tb.close();
  });

  it('[H5P-003] seedLibraries refuses a folder with a leaky package before the first install, naming it', async () => {
    // Act
    const error = await seedLibraries(await seedFolder([clean, leaky]), installer).catch((e: unknown) => e);
    // Assert
    expect(error).toBeInstanceOf(LibrarySecretsFoundError);
    expect((error as Error).message).toContain(
      'H5P.B-Leaky.h5p: H5P.RecorderProbe-1.0/dist/recorder.js holds HTTPS_PROXY',
    );
    expect((error as Error).message).not.toContain(VALUE);
    const installed = await tb.runtime.editor.libraryManager.listInstalledLibraries();
    expect(Object.keys(installed)).toEqual([]);
  });

  it('[H5P-003] seedLibraries refuses an archive the zip guard refuses before the first install, after a clean one too', async () => {
    // Arrange: the clean package first by name, then one with a name twice, which only the zip guard refuses.
    const twice = await buildH5pPackage(
      { main: MULTI_CHOICE, files: { 'xx/one.js': 'x', 'yy/one.js': 'y' } },
      'H5P.C-Twice.h5p',
    );
    const bytes = readFileSync(twice).toString('latin1').split('yy/one.js').join('xx/one.js');
    writeFileSync(twice, Buffer.from(bytes, 'latin1'));
    // Act
    const error = await seedLibraries(await seedFolder([clean, twice]), installer).catch((e: unknown) => e);
    // Assert
    expect(error).toMatchObject({ messageKey: 'upload.archive.unsafePath' });
    const installed = await tb.runtime.editor.libraryManager.listInstalledLibraries();
    expect(Object.keys(installed)).toEqual([]);
  });

  it('[H5P-003] npm run seed:libraries exits 1 on a leaky package and installs nothing', async () => {
    // Arrange
    const libraryDir = tempFolder();
    // Act
    const run = await runScript('seed:libraries', [await seedFolder([leaky])], libraryDir);
    // Assert
    expect(run.code, run.out).toBe(1);
    expect(run.out).toContain('H5P.B-Leaky.h5p: H5P.RecorderProbe-1.0/dist/recorder.js holds HTTPS_PROXY');
    expect(run.out).not.toContain(VALUE);
  }, 90_000);

  it('[H5P-003] npm run seed:libraries exits 1 when the library folder keeps an old leaky build', async () => {
    // Arrange: a storage seeded before the fix, re-seeded from a folder that changes nothing.
    const libraryDir = tempFolder();
    mkdirSync(join(libraryDir, 'H5P.AudioRecorder-1.0', 'dist'), { recursive: true });
    writeFileSync(join(libraryDir, 'H5P.AudioRecorder-1.0', 'dist', 'h5p-audio-recorder.js'), LEAK);
    // Act
    const run = await runScript('seed:libraries', [await seedFolder([])], libraryDir);
    // Assert
    expect(run.code, run.out).toBe(1);
    expect(run.out).toContain('H5P.AudioRecorder-1.0/dist/h5p-audio-recorder.js holds HTTPS_PROXY');
    expect(run.out).toContain('delete each library folder named here');
    expect(run.out).not.toContain(VALUE);
  }, 90_000);

  it('[H5P-003] npm run libraries:check passes a clean library folder and names a leaky one', async () => {
    // Arrange
    const libraryDir = tempFolder();
    mkdirSync(join(libraryDir, 'H5P.Clean-1.0'));
    writeFileSync(join(libraryDir, 'H5P.Clean-1.0', 'library.json'), '{"machineName":"H5P.Clean"}');
    // Act
    const passed = await runScript('libraries:check', [], libraryDir);
    mkdirSync(join(libraryDir, 'H5P.AudioRecorder-1.0'));
    writeFileSync(join(libraryDir, 'H5P.AudioRecorder-1.0', 'recorder.js'), LEAK);
    const failed = await runScript('libraries:check', [libraryDir], tempFolder());
    // A relative folder is read from apps/server, typed from the repository root as in the runbook.
    const inServer = mkdtempSync(join(SERVER_DIR, 'var', 'hvli-check-'));
    folders.push(inServer);
    mkdirSync(join(inServer, 'H5P.AudioRecorder-1.0'));
    writeFileSync(join(inServer, 'H5P.AudioRecorder-1.0', 'recorder.js'), LEAK);
    const fromRoot = await runScript(
      'libraries:check',
      [relative(SERVER_DIR, inServer)],
      tempFolder(),
      REPO_ROOT,
    );
    // Assert
    expect(passed.code, passed.out).toBe(0);
    expect(passed.out).toContain('1 library folders');
    expect(failed.code, failed.out).toBe(1);
    expect(failed.out).toContain('H5P.AudioRecorder-1.0/recorder.js holds HTTPS_PROXY');
    expect(failed.out).not.toContain(VALUE);
    expect(fromRoot.code, fromRoot.out).toBe(1);
    expect(fromRoot.out).toContain('H5P.AudioRecorder-1.0/recorder.js holds HTTPS_PROXY');
  }, 90_000);
});
