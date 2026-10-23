/**
 * seedLibraries — installs the content types from the verified seed packages, offline and repeatably.
 *
 * Why: H5P-003 requires that a new installation (and CI) gets exactly the reviewed libraries without the Hub.
 *      The folder must hold exactly the packages that `SHA256SUMS` lists; every hash is checked before
 *      anything is installed, so one wrong or extra file stops the whole run with nothing changed.
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - An unlisted `.h5p` file, a listed but missing file, or any hash mismatch fails before the first install.
 *   - Packages are installed in file-name order; a second run installs nothing and writes no audit rows.
 *   - Needs no network: Lumi installs from the local package files only.
 * Collaborators: ./LibraryInstaller.ts, ./sha256Sums.ts, ./seedCli.ts.
 * Tests: apps/server/test/h5p/libraries/seedLibraries.int.test.ts
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PackageHashMismatchError, type LibraryInstaller } from './LibraryInstaller.js';
import { parseSha256Sums, sha256File } from './sha256Sums.js';

/** The pin list in the package folder. */
export const SHA256SUMS_FILE = 'SHA256SUMS';

/** Counts of one seed run. */
export interface SeedSummary {
  /** Packages read. */
  readonly packages: number;
  /** Libraries installed for the first time. */
  readonly installed: number;
  /** Libraries replaced by a newer patch version (Lumi leaves libraries it already has unreported). */
  readonly updated: number;
}

/** Thrown when the package folder and SHA256SUMS disagree. */
export class SeedFolderError extends Error {
  /**
   * @param problem - What is wrong, naming the file.
   */
  constructor(problem: string) {
    super(problem);
    this.name = 'SeedFolderError';
  }
}

async function verifiedPackages(dir: string): Promise<[string, string][]> {
  const sums = parseSha256Sums(await readFile(join(dir, SHA256SUMS_FILE), 'utf8'));
  const present = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith('.h5p')).sort();
  const unlisted = present.find((name) => !sums.has(name));
  if (unlisted) throw new SeedFolderError(`${unlisted} is not listed in ${SHA256SUMS_FILE}`);
  const missing = [...sums.keys()].find((name) => !present.includes(name));
  if (missing) throw new SeedFolderError(`${missing} is listed in ${SHA256SUMS_FILE} but missing`);
  for (const name of present) {
    if ((await sha256File(join(dir, name))) !== sums.get(name)) throw new PackageHashMismatchError(name);
  }
  return present.map((name) => [name, sums.get(name) ?? '']);
}

/**
 * Seeds the libraries from a package folder.
 * @param dir - Folder with the `.h5p` files and `SHA256SUMS`.
 * @param installer - The audited installer.
 * @returns How many packages were read and libraries installed or updated.
 * @throws SeedFolderError, PackageHashMismatchError or ZipRejectedError; nothing is installed after a folder
 *   or hash error.
 */
export async function seedLibraries(dir: string, installer: LibraryInstaller): Promise<SeedSummary> {
  const packages = await verifiedPackages(dir);
  const counts = { installed: 0, updated: 0 };
  for (const [name, sha256] of packages) {
    for (const result of await installer.install(join(dir, name), name, sha256)) {
      if (result.type === 'new') counts.installed += 1;
      if (result.type === 'patch') counts.updated += 1;
    }
  }
  return { packages: packages.length, ...counts };
}
