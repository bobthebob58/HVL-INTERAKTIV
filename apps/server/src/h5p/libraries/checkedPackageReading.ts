/**
 * checkedPackageReading — makes Lumi read a package only through the reader that checked it.
 *
 * Why: the archive check and the manifest reader read an uploaded package with one zip reader
 *      (../../security/zipEntryGuard.ts). Lumi 10.0.4 then opens the file again with another reader, to compare
 *      sizes and to unpack. What was checked must be what is unpacked: the same entries, under the same names, with
 *      no more bytes than they declare, and the file closed afterwards whatever happens. So the two Lumi functions
 *      that open a package are replaced by ours, and Lumi works on the unpacked folder as before (D-118).
 * Spec: SEC-005, SEC-003
 * Invariants:
 *   - Entries come from `readEntries`, in the name form `inspectZip` accepted, and are written through yauzl's size
 *     validation: an entry that unpacks to another size than it declares stops the import.
 *   - Lumi's own choice of entries is kept: `content/`, the library folders and `h5p.json`, by its three flags;
 *     no directory entries and no file whose base name starts with `.` or `_`.
 *   - Nothing is written outside the target folder, and never more bytes in all than `DEFAULT_ZIP_LIMITS` allows.
 *   - The package file is closed, and a half-written file's streams destroyed, when unpacking ends or fails.
 *   - An entry that cannot be read, or whose name is at once a file and a folder of the package, is 400
 *     `upload.archive.unreadable`; a failure of the disk or the temporary area stays a server error.
 *   - `useCheckedPackageReading` replaces `PackageImporter.extractPackage` and
 *     `PackageValidator.prototype.validateFileSizes`, the only places where Lumi opens a package
 *     (test/h5p/upstream/lumiPackageReading.test.ts fails when an upgrade adds another).
 * Collaborators: ../../security/zipEntryGuard.ts, ../lumiInternals.ts, ../H5pEditorFactory.ts (installs it for
 *   every editor), Lumi's PackageImporter.processPackage (the caller of both functions).
 * Tests: apps/server/test/h5p/libraries/checkedPackageReading.test.ts,
 *   apps/server/test/h5p/upstream/lumiPackageReading.test.ts,
 *   apps/server/test/http/packageImportOpenFiles.int.test.ts
 */
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DEFAULT_ZIP_LIMITS,
  inspectZip,
  openEntryStream,
  openZip,
  readEntries,
  ZipRejectedError,
  type ZipLimits,
} from '../../security/zipEntryGuard.js';
import { PackageImporter, PackageValidator } from '../lumiInternals.js';

/** Which parts of a package Lumi asks for (the third argument of its `extractPackage`). */
export interface PackageParts {
  readonly includeLibraries?: boolean;
  readonly includeContent?: boolean;
  readonly includeMetadata?: boolean;
}

const MB = 1024 * 1024;

// UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/PackageImporter.ts
// (extractPackage): the same choice of entries. Keep the two in step on every Lumi upgrade.
function isWanted(name: string, parts: PackageParts): boolean {
  const base = basename(name);
  if (name.endsWith('/') || base.startsWith('.') || base.startsWith('_')) return false;
  if (name.startsWith('content/')) return parts.includeContent === true;
  if (name.includes('/')) return parts.includeLibraries === true;
  return name === 'h5p.json' && parts.includeMetadata === true;
}

const NAME_CLASHES: ReadonlySet<string> = new Set(['EISDIR', 'ENOTDIR', 'EEXIST']);

/** What a failure while writing one entry is answered with. */
function asAnswer(error: unknown): unknown {
  if (error instanceof ZipRejectedError) return error;
  const { code, syscall } = error as NodeJS.ErrnoException;
  // WHY: a full or failing temporary area is the server's fault, not the package's; it stays a server error.
  if (typeof syscall === 'string' && !NAME_CLASHES.has(code ?? '')) return error;
  return new ZipRejectedError('upload.archive.unreadable');
}

/**
 * Unpacks the wanted parts of a package into a folder, with the reader of the archive check.
 * @param packagePath - The .h5p file.
 * @param directoryPath - The folder to unpack into (Lumi's temporary folder).
 * @param parts - Which parts to unpack; none by default, as in Lumi.
 * @param limits - The most bytes to write in all; SEC-005's total limit outside tests.
 * @throws ZipRejectedError `upload.archive.unreadable` for an entry that cannot be read or does not unpack to its
 *   declared size, `upload.archive.unsafePath` for a name outside the folder, `upload.archive.totalTooLarge` past
 *   the total limit.
 */
export async function extractCheckedPackage(
  packagePath: string,
  directoryPath: string,
  parts: PackageParts = {},
  limits: Pick<ZipLimits, 'maxTotalSize'> = DEFAULT_ZIP_LIMITS,
): Promise<void> {
  const root = resolve(directoryPath);
  const maxTotal = limits.maxTotalSize;
  let written = 0;
  const zip = await openZip(packagePath);
  try {
    for await (const entry of readEntries(zip)) {
      if (!isWanted(entry.fileName, parts)) continue;
      const target = join(root, entry.fileName);
      // SECURITY: the archive check refuses such names before Lumi calls this; unpacking does not rely on it.
      if (!target.startsWith(root + sep))
        throw new ZipRejectedError('upload.archive.unsafePath', { entry: entry.fileName });
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          written += chunk.length;
          if (written <= maxTotal) return done(null, chunk);
          done(new ZipRejectedError('upload.archive.totalTooLarge', { maxMb: maxTotal / MB }));
        },
      });
      try {
        await mkdir(dirname(target), { recursive: true });
        // WHY: pipeline destroys every stream when one fails, which also releases the reader's hold on the file.
        await pipeline(await openEntryStream(zip, entry), meter, createWriteStream(target));
      } catch (error) {
        throw asAnswer(error);
      }
    }
  } finally {
    zip.close();
  }
}

let installed = false;

/**
 * Replaces the two Lumi functions that open a package, for every importer of this process.
 * @spec SEC-005
 */
export function useCheckedPackageReading(): void {
  if (installed) return;
  // SECURITY: after this, Lumi's own zip reader never opens an uploaded package.
  PackageImporter.extractPackage = (packagePath, directoryPath, parts) =>
    extractCheckedPackage(packagePath, directoryPath, parts);
  PackageValidator.prototype.validateFileSizes = async (packagePath: string): Promise<boolean> => {
    await inspectZip(packagePath);
    return true;
  };
  installed = true;
}
