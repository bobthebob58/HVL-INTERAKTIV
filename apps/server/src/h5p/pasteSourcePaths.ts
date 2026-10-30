/**
 * pasteSourcePaths — reads and writes Lumi's paste-source file paths `../<contentId>/<file>`.
 *
 * Why: when a saved activity refers to a file as `../<sourceId>/<file>`, Lumi 10.0.4 copies that file from the
 *      other activity into the one being saved (ContentStorer.copyFilesFromPasteSource). H5P's copy and paste in the
 *      editor produces such paths, and the duplicator writes them on purpose (D-092). Both the editor's guard and
 *      the duplicator must recognise exactly the paths Lumi recognises, so the pattern lives here once.
 * Spec: PROD-007, SEC-008
 * Invariants:
 *   - `parsePasteSourcePath` matches what Lumi matches, `../content/<id>/…` included, and nothing else.
 *   - `fitsLumiFilePattern` is Lumi's own file-name pattern: a stored name outside it (spaces, æøå from an imported
 *     package) is never copied by Lumi, so the duplicator copies it itself (D-092).
 * Collaborators: ./pasteSourceGuard.ts, ../learningDesign/collaboration/pasteSourceRewrite.ts.
 * Tests: apps/server/test/h5p/pasteSourcePaths.test.ts
 */

// UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/ContentStorer.ts
// (copyFilesFromPasteSource) holds these two patterns. They must change when Lumi's do: a narrower Lumi pattern fails
// apps/server/test/learningDesign/collaboration/duplicateFiles.int.test.ts and the ContentDuplicator tests, but a
// wider one fails nothing (the duplicator would only copy some names itself that Lumi could copy), so compare by hand.
const LUMI_PASTE_SOURCE = /^\.\.\/(content\/)?([\w\-._]+)\/([\w\-./_]+)$/;
const LUMI_FILE_NAME = /^[\w\-./_]+$/;

/** A file of another activity, as a paste-source path names it. */
export interface PasteSource {
  /** The other activity's ID as the path gives it (untrusted; not necessarily a UUID). */
  readonly sourceId: string;
  /** The file's name in that activity, e.g. `images/diagram-1a2B3c4D.png` (untrusted; may contain `..`). */
  readonly file: string;
}

/**
 * Reads a file path in Lumi's paste-source form.
 * @param path - A file reference's path, without a `#tmp` suffix (as ContentFileScanner reports it).
 * @returns The source and file Lumi would copy, or `undefined` when Lumi would not treat it as a paste.
 */
export function parsePasteSourcePath(path: string): PasteSource | undefined {
  const match = LUMI_PASTE_SOURCE.exec(path);
  if (!match) return undefined;
  const [, , sourceId = '', file = ''] = match;
  return { sourceId, file };
}

/**
 * Builds the paste-source path that makes Lumi copy a file of another activity on save.
 * @param sourceId - The source activity's ID.
 * @param file - The file's name in the source.
 * @returns `../<sourceId>/<file>`.
 */
export const pasteSourcePath = (sourceId: string, file: string): string => `../${sourceId}/${file}`;

/**
 * Tells whether Lumi would copy a file of this name from a paste source.
 * @param file - A stored file name.
 * @returns True when the name fits Lumi's pattern (ASCII letters, digits, `_`, `-`, `.` and `/` only).
 */
export const fitsLumiFilePattern = (file: string): boolean => LUMI_FILE_NAME.test(file);
