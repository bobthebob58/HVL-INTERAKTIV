/**
 * damagedPackage — damages one entry of a built .h5p package so that it lists normally but cannot be read.
 *
 * Why: the import must answer and clean up when a package's directory is intact but an entry's data is broken
 *      (a failed download, a bad disk); only a file damaged in exactly that way shows it.
 * Spec: SEC-005
 * Invariants:
 *   - Only the first bytes of the named entry's compressed data change; names, sizes and every other entry stay.
 * Collaborators: ./h5pPackageBuilder.ts (builds the package), ../../src/security/zipEntryGuard.ts (finds the entry).
 * Tests: used by apps/server/test/http/packageImportOpenFiles.int.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { openZip, readEntries } from '../../src/security/zipEntryGuard.js';

const LOCAL_HEADER_BYTES = 30;

/**
 * Overwrites the start of an entry's compressed data with bytes no deflate stream can begin with.
 * @param path - The .h5p file, changed in place.
 * @param name - The entry to damage, e.g. `content/content.json`.
 * @throws Error when the package has no such entry.
 */
export async function damageEntry(path: string, name: string): Promise<void> {
  const zip = await openZip(path);
  let headerAt: number | undefined;
  try {
    for await (const entry of readEntries(zip)) {
      if (entry.fileName === name) headerAt = entry.relativeOffsetOfLocalHeader;
    }
  } finally {
    zip.close();
  }
  if (headerAt === undefined) throw new Error(`no entry ${name} in ${path}`);
  const bytes = readFileSync(path);
  const dataAt =
    headerAt + LOCAL_HEADER_BYTES + bytes.readUInt16LE(headerAt + 26) + bytes.readUInt16LE(headerAt + 28);
  bytes.fill(0xff, dataAt, dataAt + 4);
  writeFileSync(path, bytes);
}
