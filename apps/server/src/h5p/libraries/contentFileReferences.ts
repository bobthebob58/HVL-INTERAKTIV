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
 *   - Every string under a `path` key counts as a reference (Lumi's file objects are `{ path, mime, … }`); web
 *     URLs are skipped, as Lumi does not copy them.
 *   - A reference with a backslash, a leading `/`, a drive letter or a `..` segment is refused.
 *   - Iterative, so deeply nested parameters cannot overflow the stack.
 * Collaborators: ./packageManifest.ts (reads content.json and calls the check), ../../security/zipEntryGuard.ts.
 * Tests: apps/server/test/h5p/libraries/packageManifest.test.ts, apps/server/test/http/packageImport.int.test.ts
 */
import { ZipRejectedError } from '../../security/zipEntryGuard.js';

const WEB_URL = /^https?:\/\//i;

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
 * Refuses references that would leave the package's content folder.
 * @param paths - Paths from content.json.
 * @throws ZipRejectedError `upload.archive.unsafePath` naming the first unsafe path.
 */
export function assertContentFilesInside(paths: readonly string[]): void {
  for (const raw of paths) {
    if (WEB_URL.test(raw)) continue;
    const path = raw.replace(/#tmp$/, '');
    const unsafe =
      path.includes('\\') ||
      path.startsWith('/') ||
      /^[a-zA-Z]:/.test(path) ||
      path.split('/').some((segment) => segment === '..');
    if (unsafe) throw new ZipRejectedError('upload.archive.unsafePath', { entry: raw });
  }
}
