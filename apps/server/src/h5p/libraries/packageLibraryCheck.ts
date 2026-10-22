/**
 * packageLibraryCheck — an author's package may only carry libraries that are installed in the same version.
 *
 * Why: a library is code that runs for every learner. When an author imports a package, only its content may
 *      be imported (`SEC-003`); Lumi already skips installing for non-admins, but it ignores patch versions,
 *      so a package with a modified library under the same name would silently run the installed code instead
 *      of being refused with a clear reason. This check makes the rule explicit.
 * Spec: SEC-003
 * Invariants:
 *   - Every library folder in the package must be installed with exactly the same major, minor and patch version.
 *   - The error names every offending library, so the author can ask an admin.
 * Collaborators: ./packageManifest.ts, ../HvlH5PEditor.ts (non-admin imports).
 * Tests: apps/server/test/h5p/libraries/packageManifest.test.ts
 */
import { H5pError, LibraryName, type LibraryManager } from '@lumieducation/h5p-server';
import type { PackageLibrary } from './packageManifest.js';

const label = (lib: PackageLibrary): string =>
  `${LibraryName.toUberName(lib, { useWhitespace: true })}.${lib.patchVersion}`;

/**
 * Refuses a package that carries libraries the server does not have in exactly that version.
 * @param libraries - Library folders from the package manifest.
 * @param libraryManager - Lumi's library manager (installed libraries).
 * @throws H5pError `hvl:package-libraries-not-installed` (403) or `hvl:package-library-version-mismatch` (403).
 */
export async function assertPackageLibrariesInstalled(
  libraries: readonly PackageLibrary[],
  libraryManager: LibraryManager,
): Promise<void> {
  const missing: string[] = [];
  const different: string[] = [];
  for (const lib of libraries) {
    if (!(await libraryManager.libraryExists(lib))) {
      missing.push(label(lib));
      continue;
    }
    const installed = await libraryManager.getLibrary(lib);
    if (installed.patchVersion !== lib.patchVersion) different.push(label(lib));
  }
  if (missing.length > 0) {
    throw new H5pError('hvl:package-libraries-not-installed', { libraries: missing.join(', ') }, 403);
  }
  if (different.length > 0) {
    throw new H5pError('hvl:package-library-version-mismatch', { libraries: different.join(', ') }, 403);
  }
}
