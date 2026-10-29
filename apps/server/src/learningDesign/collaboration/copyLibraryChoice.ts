/**
 * copyLibraryChoice — which main library version a «Lagre som ny versjon» copy is saved with: the editor's, when it
 * is a newer or older minor version of the source's own library that is installed; otherwise the source's.
 *
 * Why: H5P's editor upgrades an activity to the newest installed minor version of its library when it opens it, and
 *      the parameters it sends are shaped for that version (D-093 as amended, S5 server side). Saving them under the
 *      source's older version would store parameters its semantics do not describe. A different machine name or
 *      major version is not an upgrade the editor makes, so the source's version is kept (D-093 amendment, S5 W4).
 * Spec: PROD-013, PROD-007, H5P-002
 * Invariants:
 *   - Accepted only with the same machine name and major version as the source, and only when the library manager
 *     says that version is installed; anything else (unparsable, another type, another major, not installed) falls
 *     back to the source's library without an error.
 *   - «Lag ein kopi» (a plain duplicate) never names a library: it always keeps the source's version.
 * Collaborators: ./ContentDuplicator.ts (the caller), ./copySource.ts (the source's library),
 *   ../../http/routes/contentRoutes.ts (the copy route's `library`), Lumi's LibraryName and LibraryManager.
 * Tests: apps/server/test/learningDesign/collaboration/copyLibraryChoice.int.test.ts
 */
import { LibraryName, type LibraryManager } from '@lumieducation/h5p-server';

/** A main library as the copy is saved with it. */
export interface CopyLibrary {
  /** The library and its version. */
  readonly library: LibraryName;
  /** The same as `H5P.Name major.minor`, as the editor's save takes it. */
  readonly ubername: string;
}

const parse = (ubername: string): LibraryName | undefined => {
  try {
    return LibraryName.fromUberName(ubername, { useWhitespace: true, useHyphen: false });
  } catch {
    return undefined;
  }
};

/**
 * Chooses the main library of a copy.
 * @param source - The source's own main library.
 * @param requested - The editor's library (`content.library`, e.g. `H5P.Column 1.22`), or undefined.
 * @param libraries - The editor's library manager, which knows what is installed.
 * @returns The editor's version when allowed, else the source's.
 * @spec PROD-013
 */
export async function chooseCopyLibrary(
  source: CopyLibrary,
  requested: string | undefined,
  libraries: Pick<LibraryManager, 'libraryExists'>,
): Promise<CopyLibrary> {
  const wanted = requested === undefined ? undefined : parse(requested);
  const sameType =
    wanted !== undefined &&
    wanted.machineName === source.library.machineName &&
    wanted.majorVersion === source.library.majorVersion;
  if (!sameType || wanted.minorVersion === source.library.minorVersion) return source;
  // SECURITY: only an installed version is saved; Lumi would otherwise fail after it wrote the row (D-092).
  if (!(await libraries.libraryExists(wanted))) return source;
  const { machineName, majorVersion, minorVersion } = wanted;
  return { library: wanted, ubername: `${machineName} ${String(majorVersion)}.${String(minorVersion)}` };
}
