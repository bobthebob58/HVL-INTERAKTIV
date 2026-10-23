/**
 * h5pPackageBuilder — builds small .h5p packages (zip files) for import and seeding tests.
 *
 * Why: tests of package import and seeding need packages with exactly the libraries, versions and files a
 *      case describes, including broken and malicious ones, without depending on the H5P Hub.
 * Spec: SEC-003, SEC-005, H5P-003
 * Invariants: every entry name occurs once; a file given for a name replaces the default one (the zip guard
 *   refuses a name that occurs twice).
 * Tests: shared by the package import, manifest and seeding tests.
 */
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yazl from 'yazl';
import { libraryFolder, libraryJson, uberName, type SyntheticLibrary } from './syntheticLibraries.js';

/** What goes into one package. */
export interface PackageSpec {
  /** The content's main library (also written as a library folder unless `omitMainFolder`). */
  main: SyntheticLibrary;
  /** Further library folders to include (dependencies, or modified copies). */
  libraries?: SyntheticLibrary[];
  /** Leave the main library's folder out (content-only package). */
  omitMainFolder?: boolean;
  /** content/content.json. */
  params?: Record<string, unknown>;
  /** Extra files by path, e.g. `{ 'content/images/a.svg': '<svg…' }`. */
  files?: Record<string, string | Buffer>;
  /** Leave h5p.json out (not a valid package). */
  omitH5pJson?: boolean;
}

const created: string[] = [];

type Entries = Map<string, Buffer>;

function addLibrary(entries: Entries, lib: SyntheticLibrary): void {
  const folder = libraryFolder(lib);
  entries.set(`${folder}/library.json`, Buffer.from(JSON.stringify(libraryJson(lib))));
  entries.set(`${folder}/semantics.json`, Buffer.from(JSON.stringify(lib.semantics ?? [])));
  entries.set(`${folder}/js/main.js`, Buffer.from(`/* ${lib.machineName} */`));
  for (const [path, content] of Object.entries(lib.files ?? {}))
    entries.set(`${folder}/${path}`, Buffer.from(content));
}

/**
 * Writes a package to a fresh temporary folder.
 * @param spec - Package contents.
 * @param fileName - File name, `content.h5p` by default.
 * @returns Absolute path of the .h5p file; remove with `removeBuiltPackages`.
 */
export async function buildH5pPackage(spec: PackageSpec, fileName = 'content.h5p'): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-pkg-'));
  created.push(dir);
  const entries: Entries = new Map();
  const main = spec.main;
  if (!spec.omitH5pJson) {
    const deps = [main, ...(spec.libraries ?? [])].map((lib) => ({
      machineName: lib.machineName,
      majorVersion: lib.majorVersion ?? 1,
      minorVersion: lib.minorVersion ?? 0,
    }));
    const h5pJson = {
      title: `Package ${uberName(main)}`,
      language: 'nn',
      mainLibrary: main.machineName,
      embedTypes: ['iframe'],
      license: 'U',
      preloadedDependencies: deps,
    };
    entries.set('h5p.json', Buffer.from(JSON.stringify(h5pJson)));
  }
  entries.set('content/content.json', Buffer.from(JSON.stringify(spec.params ?? {})));
  if (!spec.omitMainFolder) addLibrary(entries, main);
  for (const lib of spec.libraries ?? []) addLibrary(entries, lib);
  for (const [path, content] of Object.entries(spec.files ?? {})) {
    entries.set(path, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  const zip = new yazl.ZipFile();
  for (const [name, data] of entries) zip.addBuffer(data, name);
  zip.end();
  const path = join(dir, fileName);
  await pipeline(zip.outputStream, createWriteStream(path));
  return path;
}

/** Removes every folder made by `buildH5pPackage` (call in `afterAll`). */
export function removeBuiltPackages(): void {
  created.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
}
