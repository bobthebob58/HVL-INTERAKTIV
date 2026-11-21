/**
 * packageContentCheck — an author's package is imported only when its content can be read as its library's
 * semantics describe.
 *
 * Why: Lumi's importer walks the package's content.json by the semantics to find its files, and assumes every
 *      value has the JSON type of its field; a list that is an object, say, ends its walk with a TypeError, which
 *      reaches the author as a server fault. A save refuses such content with 400 before Lumi reads it
 *      (../semantics/paramsWalker.ts); this does the same for an import (D-124).
 * Spec: PROD-012, SEC-005
 * Invariants:
 *   - Content whose values do not have the JSON types Lumi's scanners read is refused with 400
 *     `hvl:invalid-params`, before the importer runs.
 *   - Only content whose main library is installed in the package's version is checked; any other package is the
 *     importer's to refuse (or, for an admin's package that brings its libraries, to install first).
 * Collaborators: ./packageManifest.ts (the parsed content), ../semantics/paramsWalker.ts, ../HvlH5PEditor.ts
 *   (non-admin imports).
 * Tests: apps/server/test/h5p/semantics/editorFormParams.int.test.ts
 */
import type { LibraryManager } from '@lumieducation/h5p-server';
import { walkParams } from '../semantics/paramsWalker.js';
import type { PackageManifest } from './packageManifest.js';

/**
 * Refuses a package whose content cannot be read as its semantics describe.
 * @param manifest - The package's manifest, with its parsed content.json.
 * @param libraryManager - Lumi's library manager (installed libraries).
 * @throws H5pError `hvl:invalid-params` (400).
 */
export async function assertReadableContent(
  manifest: PackageManifest,
  libraryManager: LibraryManager,
): Promise<void> {
  const main = manifest.mainLibraryVersion;
  if (!manifest.content || !main || !(await libraryManager.libraryExists(main))) return;
  await walkParams(
    manifest.content,
    main,
    (library) => libraryManager.getSemantics(library),
    () => undefined,
  );
}
