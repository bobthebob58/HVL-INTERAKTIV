/**
 * h5pPackageBuilder — builds small .h5p packages (zip files) for import and seeding tests.
 *
 * Why: tests of package import and seeding need packages with exactly the libraries, versions and files a
 *      case describes, including broken and malicious ones, without depending on the H5P Hub.
 * Spec: SEC-003, SEC-005, H5P-003
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

function addLibrary(zip: yazl.ZipFile, lib: SyntheticLibrary): void {
  const folder = libraryFolder(lib);
  zip.addBuffer(Buffer.from(JSON.stringify(libraryJson(lib))), `${folder}/library.json`);
  zip.addBuffer(Buffer.from(JSON.stringify(lib.semantics ?? [])), `${folder}/semantics.json`);
  zip.addBuffer(Buffer.from(`/* ${lib.machineName} */`), `${folder}/js/main.js`);
  for (const [path, content] of Object.entries(lib.files ?? {}))
    zip.addBuffer(Buffer.from(content), `${folder}/${path}`);
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
  const zip = new yazl.ZipFile();
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
    zip.addBuffer(Buffer.from(JSON.stringify(h5pJson)), 'h5p.json');
  }
  zip.addBuffer(Buffer.from(JSON.stringify(spec.params ?? {})), 'content/content.json');
  if (!spec.omitMainFolder) addLibrary(zip, main);
  for (const lib of spec.libraries ?? []) addLibrary(zip, lib);
  for (const [path, content] of Object.entries(spec.files ?? {})) {
    zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(content), path);
  }
  zip.end();
  const path = join(dir, fileName);
  await pipeline(zip.outputStream, createWriteStream(path));
  return path;
}

/** Removes every folder made by `buildH5pPackage` (call in `afterAll`). */
export function removeBuiltPackages(): void {
  created.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
}
