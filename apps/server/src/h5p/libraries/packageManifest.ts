/**
 * packageManifest — reads what an .h5p package declares, without extracting it.
 *
 * Why: before Lumi unpacks an author's package, the server must know its main library (only the ten types,
 *      `H5P-002`) and which library versions it carries (`SEC-003`: never install or swap code for non-admins).
 *      Reading `h5p.json` and the top-level `library.json` files straight from the zip answers both.
 * Spec: SEC-003, H5P-002, SEC-005
 * Invariants:
 *   - Run after `inspectZip`, so names, sizes and entry counts are already checked.
 *   - Only `h5p.json` and `<folder>/library.json` (each at most `MAX_MANIFEST_BYTES`) and `content/content.json`
 *     (at most the upload limit) are read.
 *   - A package without a readable `h5p.json` naming a main library is refused as "not an H5P package".
 *   - A file reference in content.json that leaves `content/` is refused (./contentFileReferences.ts).
 * Collaborators: ../../security/zipEntryGuard.ts (zip reader), ./contentFileReferences.ts,
 *   ./packageLibraryCheck.ts, ../HvlH5PEditor.ts, ./LibraryInstaller.ts.
 * Tests: apps/server/test/h5p/libraries/packageManifest.test.ts
 */
import type { Readable } from 'node:stream';
import type yauzl from 'yauzl';
import type { ILibraryName } from '@lumieducation/h5p-server';
import { openZip, readEntries, ZipRejectedError } from '../../security/zipEntryGuard.js';
import { MAX_FILE_SIZE } from '../H5pConfigFactory.js';
import { assertContentFilesInside, contentFilePaths } from './contentFileReferences.js';

/** Largest manifest file read (library.json and h5p.json are a few kilobytes). */
export const MAX_MANIFEST_BYTES = 1024 * 1024;

/** A library folder inside a package, with its full version. */
export interface PackageLibrary extends ILibraryName {
  /** Patch version from its library.json. */
  readonly patchVersion: number;
}

/** What a package declares. */
export interface PackageManifest {
  /** Main library machine name from h5p.json, e.g. `H5P.MultiChoice`. */
  readonly mainLibrary: string;
  /** The main library with its major and minor version, from `preloadedDependencies`. */
  readonly mainLibraryVersion?: ILibraryName;
  /** Library folders the package carries (code an install would add or replace). */
  readonly libraries: readonly PackageLibrary[];
}

const notH5p = (): ZipRejectedError => new ZipRejectedError('upload.package.notH5p');

function readText(zip: yauzl.ZipFile, entry: yauzl.Entry, maxBytes = MAX_MANIFEST_BYTES): Promise<string> {
  if (entry.uncompressedSize > maxBytes) return Promise.reject(notH5p());
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream?: Readable) => {
      if (error || !stream) return reject(notH5p());
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', () => reject(notH5p()));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  });
}

const parse = (text: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    throw notH5p();
  }
};

const isInt = (value: unknown): value is number => Number.isInteger(value);

function toLibrary(json: Record<string, unknown>): PackageLibrary | undefined {
  const { machineName, majorVersion, minorVersion, patchVersion } = json;
  if (typeof machineName !== 'string' || !isInt(majorVersion) || !isInt(minorVersion)) return undefined;
  return { machineName, majorVersion, minorVersion, patchVersion: isInt(patchVersion) ? patchVersion : 0 };
}

/**
 * Reads h5p.json and the top-level library.json files of a package.
 * @param path - Path of the .h5p file.
 * @returns The main library and the libraries the package carries.
 * @throws ZipRejectedError `upload.package.notH5p` when h5p.json is missing or unreadable;
 *   `upload.archive.unsafePath` when content.json points at a file outside `content/`.
 */
export async function readPackageManifest(path: string): Promise<PackageManifest> {
  const zip = await openZip(path);
  let h5pJson: Record<string, unknown> | undefined;
  const libraries: PackageLibrary[] = [];
  try {
    for await (const entry of readEntries(zip)) {
      const name = entry.fileName.replace(/\\/g, '/');
      if (name === 'h5p.json') h5pJson = parse(await readText(zip, entry));
      else if (name === 'content/content.json')
        assertContentFilesInside(contentFilePaths(parse(await readText(zip, entry, MAX_FILE_SIZE))));
      else if (/^[^/]+\/library\.json$/.test(name)) {
        const library = toLibrary(parse(await readText(zip, entry)));
        if (library) libraries.push(library);
      }
    }
  } finally {
    zip.close();
  }
  if (!h5pJson || typeof h5pJson.mainLibrary !== 'string') throw notH5p();
  const mainLibrary = h5pJson.mainLibrary;
  const dependencies = Array.isArray(h5pJson.preloadedDependencies) ? h5pJson.preloadedDependencies : [];
  const main = dependencies
    .map((d) => toLibrary(d as Record<string, unknown>))
    .find((d) => d?.machineName === mainLibrary);
  return { mainLibrary, ...(main ? { mainLibraryVersion: main } : {}), libraries };
}
