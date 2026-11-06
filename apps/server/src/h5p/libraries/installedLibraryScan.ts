/**
 * installedLibraryScan — finds a build machine's secrets in the libraries already installed in a library folder.
 *
 * Why: re-seeding does not replace an installed library of the same patch version (Lumi's
 *      `LibraryManager.installFromDirectory`), so a storage seeded before the build fix keeps its leaky
 *      `H5P.AudioRecorder-1.0` until someone deletes it (D-110 amendments of 2026-11-06). The seed command runs this
 *      after it installs, and `npm run libraries:check` runs it alone, so such a storage is named, not served.
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - Reads only regular files below the top-level folders of the library folder; symbolic links are not followed.
 *   - SECURITY: the findings and the error name the library folder, the file and the variables, never a value.
 * Collaborators: ./librarySecretFindings.ts, ./libraryBuildSecrets.ts, ./seedCli.ts, ./libraryStorageCheckCli.ts.
 * Tests: apps/server/test/h5p/libraries/librarySecretScans.test.ts
 */
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import {
  LibrarySecretsFoundError,
  scanLibraryFile,
  type LibrarySecretFinding,
} from './librarySecretFindings.js';

/** What a scan of a library folder found. */
export interface InstalledLibraryScan {
  /** How many library folders were scanned. */
  readonly libraries: number;
  /** One finding per file that holds secrets. */
  readonly findings: readonly LibrarySecretFinding[];
}

/**
 * Scans every installed library.
 * @param libraryDir - The library folder (`H5P_LIBRARY_DIR`), with one folder per library.
 * @returns The number of library folders and the findings; no findings when the folder is clean.
 */
export async function scanInstalledLibraries(libraryDir: string): Promise<InstalledLibraryScan> {
  const folders = (await readdir(libraryDir, { withFileTypes: true })).filter((d) => d.isDirectory());
  const findings: LibrarySecretFinding[] = [];
  for (const folder of folders.map((d) => d.name).sort()) {
    const root = join(libraryDir, folder);
    const files = (await readdir(root, { withFileTypes: true, recursive: true }))
      .filter((d) => d.isFile())
      .map((d) => join(d.parentPath, d.name))
      .sort();
    for (const path of files) {
      const where = { library: folder, file: relative(root, path).split(sep).join('/') };
      const finding = await scanLibraryFile(where, (await lstat(path)).size, () => readFile(path, 'utf8'));
      if (finding) findings.push(finding);
    }
  }
  return { libraries: folders.length, findings };
}

/**
 * Refuses a library folder that holds a library with a build machine's secrets.
 * @param libraryDir - The library folder.
 * @returns How many library folders were scanned.
 * @throws LibrarySecretsFoundError naming each library folder to delete.
 */
export async function assertInstalledLibrariesClean(libraryDir: string): Promise<number> {
  const { libraries, findings } = await scanInstalledLibraries(libraryDir);
  if (findings.length > 0)
    throw new LibrarySecretsFoundError(
      findings,
      'delete each library folder named here, or the whole library volume, then seed again from a bundle built ' +
        'in CI; docs/ops/runbook.md, section 2',
    );
  return libraries;
}
