/**
 * contentFileReferences — the file paths a package's content.json points at, and the rule that they stay inside
 * the package's `content/` folder.
 *
 * Why: when Lumi imports a package it copies each referenced file with `path.join(packageDir, 'content',
 *      reference)` and then runs the file sanitisers on that path (ContentStorer.copyFromDirectoryToTemporary).
 *      The zip guard only checks entry names, so a `path` of `../../x.svg` in content.json would make the SVG
 *      sanitiser rewrite a file outside the package. Every reference is checked before Lumi sees the package.
 * Spec: SEC-005, SEC-001
 * Invariants:
 *   - Every string under a `path` key counts as a reference (Lumi's file objects are `{ path, mime, … }`). Only
 *     what Lumi itself skips as a web URL is skipped: a lower-case `http://` or `https://` prefix, nothing else.
 *   - A reference with a backslash, a leading `/`, a drive letter or a `..` segment is refused.
 *   - A reference to a file the package carries is also refused when the storage would refuse its spelling
 *     (`isStorableFileName`: an empty or `.` segment, a control character): Lumi copies such a file into the
 *     storage under the reference's own spelling, so the answer is given here, before anything is unpacked, never
 *     by the storage in the middle of the copy (D-118). A reference to a file the package does not carry is never
 *     stored (Lumi clears it or keeps it as a link), so its spelling is not judged.
 *   - An empty reference is no reference: Lumi ignores it, and so does this check. One that is only `#tmp` is refused.
 *   - Iterative, so deeply nested parameters cannot overflow the stack.
 * Collaborators: ./packageManifest.ts (reads content.json and calls the check), ../../security/zipEntryGuard.ts,
 *   ../storage/storableFileName.ts (the storage's name rule).
 * Tests: apps/server/test/h5p/libraries/packageManifest.test.ts, apps/server/test/http/packageImport.int.test.ts,
 *   apps/server/test/http/packageImportOpenFiles.int.test.ts
 */
import { posix } from 'node:path';
import { ZipRejectedError } from '../../security/zipEntryGuard.js';
import { isStorableFileName } from '../storage/storableFileName.js';

// SECURITY: exactly Lumi's test (case-sensitive). `HTTPS://../x` is no URL to Lumi: it joins it to the package
// folder like any file name, so it must go through the checks below.
// UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/ContentFileScanner.ts
// (urlRegExp). Keep the two in step on every Lumi upgrade.
const WEB_URL = /^https?:\/\//;

/**
 * Collects every `path` string in content parameters.
 * @param params - Parsed content.json.
 * @returns The paths, in no particular order.
 */
export function contentFilePaths(params: unknown): string[] {
  const paths: string[] = [];
  const pending: unknown[] = [params];
  while (pending.length > 0) {
    const node = pending.pop();
    if (typeof node !== 'object' || node === null) continue;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'path' && typeof value === 'string') paths.push(value);
      else pending.push(value);
    }
  }
  return paths;
}

/**
 * Refuses references that would leave the package's content folder, or that name a carried file in a spelling
 * the storage would refuse.
 * @param paths - Paths from content.json.
 * @param isCarried - Tells whether the package carries a file under this entry name (`content/...`, as
 *   `path.join` spells it); without it every reference counts as carried.
 * @throws ZipRejectedError `upload.archive.unsafePath` naming the first unsafe path.
 */
export function assertContentFilesInside(
  paths: readonly string[],
  isCarried: (entryName: string) => boolean = () => true,
): void {
  for (const raw of paths) {
    if (raw === '' || WEB_URL.test(raw)) continue;
    const path = raw.replace(/#tmp$/, '');
    const leaves =
      path === '' ||
      path.includes('\\') ||
      path.startsWith('/') ||
      /^[a-zA-Z]:/.test(path) ||
      path.split('/').some((segment) => segment === '..');
    // SECURITY: the same join Lumi uses to find the file; what it finds, it stores under the reference's spelling.
    const unstorable = !leaves && !isStorableFileName(path) && isCarried(posix.join('content', path));
    if (leaves || unstorable) throw new ZipRejectedError('upload.archive.unsafePath', { entry: raw });
  }
}
