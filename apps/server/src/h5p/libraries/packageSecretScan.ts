/**
 * packageSecretScan — finds a build machine's secrets in the library folders of an .h5p package, before anything
 * from it is installed.
 *
 * Why: besides the bundle (whose tool runs the same rules), libraries reach a running HVL Interaktiv by the seed
 *      command and by an administrator's package import (D-041), and either could carry a library build that baked
 *      its build machine's environment into its JavaScript (D-110 amendments of 2026-11-05 and 2026-11-06).
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - Run after `inspectZip`: names, sizes and the entry count are checked, so each entry is read once and bounded.
 *   - Only library folders are read (every top-level folder but `content/`): content is the author's data, never
 *     installed as code, and may quote anything (a programming course may show `API_KEY: "…"`).
 *   - SECURITY: the findings and the error name the library folder, the file and the variables, never a value.
 * Collaborators: ./librarySecretFindings.ts, ./libraryBuildSecrets.ts, ../../security/zipEntryGuard.ts (the reader),
 *   ./seedLibraries.ts, ../HvlH5PEditor.ts.
 * Tests: apps/server/test/h5p/libraries/librarySecretScans.test.ts, apps/server/test/h5p/libraries/seedSecretScan.int.test.ts,
 *   apps/server/test/h5p/libraries/librarySecretImport.int.test.ts
 */
import type { Readable } from 'node:stream';
import type yauzl from 'yauzl';
import { openZip, readEntries, ZipRejectedError } from '../../security/zipEntryGuard.js';
import {
  LibrarySecretsFoundError,
  scanLibraryFile,
  type LibrarySecretFinding,
} from './librarySecretFindings.js';

const readText = (zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> =>
  new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream?: Readable) => {
      if (error || !stream) return reject(new ZipRejectedError('upload.archive.unreadable'));
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', () => reject(new ZipRejectedError('upload.archive.unreadable')));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  });

/**
 * The library files of a package that hold a build machine's secrets.
 * @param path - The .h5p file, already checked by `inspectZip`.
 * @returns One finding per file, in the package's order; empty when its libraries are clean.
 * @throws ZipRejectedError `upload.archive.unreadable` when an entry cannot be read.
 */
export async function librarySecretsInPackage(path: string): Promise<LibrarySecretFinding[]> {
  const zip = await openZip(path);
  const findings: LibrarySecretFinding[] = [];
  try {
    for await (const entry of readEntries(zip)) {
      const [library = '', ...rest] = entry.fileName.replace(/\\/g, '/').split('/');
      const file = rest.join('/');
      if (library === 'content' || file === '' || file.endsWith('/')) continue;
      const finding = await scanLibraryFile({ library, file }, entry.uncompressedSize, () =>
        readText(zip, entry),
      );
      if (finding) findings.push(finding);
    }
  } finally {
    zip.close();
  }
  return findings;
}

/**
 * Refuses a package whose library files hold a build machine's secrets.
 * @param path - The .h5p file, already checked by `inspectZip`.
 * @throws LibrarySecretsFoundError (400, `upload.package.librarySecrets`) naming every finding.
 */
export async function assertNoLibrarySecrets(path: string): Promise<void> {
  const findings = await librarySecretsInPackage(path);
  if (findings.length > 0)
    throw new LibrarySecretsFoundError(findings, 'nothing was installed; rebuild them without it');
}
