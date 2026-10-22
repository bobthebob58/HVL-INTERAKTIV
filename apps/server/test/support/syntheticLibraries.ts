/**
 * syntheticLibraries — writes small, made-up H5P libraries to a temporary folder for tests.
 *
 * Why: the real content types come from the Hub (blocked in some environments) and are large. Tests
 *      of semantics, language files, package import and seeding need only a few fields, so they build
 *      exactly the libraries they describe, on disk, in the layout Lumi's FileLibraryStorage reads.
 * Spec: H5P-002, H5P-003, H5P-008, SEC-003, SEC-008
 * Tests: shared by the S2 tests under test/h5p, test/http and test/security.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A library dependency as written in library.json. */
export interface LibraryRef {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
}

/** What a test needs to say about one library; everything else gets a harmless default. */
export interface SyntheticLibrary {
  machineName: string;
  majorVersion?: number;
  minorVersion?: number;
  patchVersion?: number;
  runnable?: boolean;
  semantics?: unknown[];
  preloadedDependencies?: LibraryRef[];
  /** Language files by language code, e.g. `{ nb: { semantics: [...] } }`. */
  languages?: Record<string, unknown>;
  /** Extra files by path inside the library folder, e.g. `{ 'js/main.js': '…' }`. */
  files?: Record<string, string>;
}

/** The folder name Lumi uses for a library: `H5P.Name-1.2`. */
export const libraryFolder = (lib: SyntheticLibrary): string =>
  `${lib.machineName}-${lib.majorVersion ?? 1}.${lib.minorVersion ?? 0}`;

/** The uber name with a space, as content metadata uses it: `H5P.Name 1.2`. */
export const uberName = (lib: SyntheticLibrary): string =>
  `${lib.machineName} ${lib.majorVersion ?? 1}.${lib.minorVersion ?? 0}`;

/**
 * The library.json of a synthetic library.
 * @param lib - Library description.
 * @returns The parsed library.json object.
 */
export function libraryJson(lib: SyntheticLibrary): Record<string, unknown> {
  return {
    title: lib.machineName,
    machineName: lib.machineName,
    majorVersion: lib.majorVersion ?? 1,
    minorVersion: lib.minorVersion ?? 0,
    patchVersion: lib.patchVersion ?? 0,
    runnable: lib.runnable ? 1 : 0,
    coreApi: { majorVersion: 1, minorVersion: 28 },
    preloadedJs: [{ path: 'js/main.js' }],
    preloadedDependencies: lib.preloadedDependencies ?? [],
    embedTypes: ['iframe'],
  };
}

/**
 * Writes one library folder below `root`.
 * @param root - Libraries directory (as for FileLibraryStorage).
 * @param lib - Library description.
 * @returns The absolute path of the library folder.
 */
export function writeLibrary(root: string, lib: SyntheticLibrary): string {
  const dir = join(root, libraryFolder(lib));
  mkdirSync(join(dir, 'js'), { recursive: true });
  writeFileSync(join(dir, 'library.json'), JSON.stringify(libraryJson(lib)));
  writeFileSync(join(dir, 'semantics.json'), JSON.stringify(lib.semantics ?? []));
  writeFileSync(join(dir, 'js/main.js'), `/* ${lib.machineName} */`);
  for (const [language, content] of Object.entries(lib.languages ?? {})) {
    mkdirSync(join(dir, 'language'), { recursive: true });
    writeFileSync(join(dir, `language/${language}.json`), JSON.stringify(content));
  }
  for (const [path, content] of Object.entries(lib.files ?? {})) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const created: string[] = [];

/**
 * Creates a fresh libraries directory holding the given libraries.
 * @param libs - Libraries to write.
 * @returns The directory; remove it with `removeSyntheticLibraryDirs`.
 */
export function syntheticLibraryDir(libs: SyntheticLibrary[]): string {
  const root = mkdtempSync(join(tmpdir(), 'h5p-libs-'));
  created.push(root);
  libs.forEach((lib) => writeLibrary(root, lib));
  return root;
}

/** Removes every directory made by `syntheticLibraryDir` (call in `afterAll`). */
export function removeSyntheticLibraryDirs(): void {
  created.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
}
