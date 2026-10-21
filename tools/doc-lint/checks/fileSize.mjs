/**
 * fileSize — source files stay at or under 200 lines.
 *
 * Why: small, single-purpose files are cheaper to review and to load into an AI assistant's context;
 *      a 500-line file hides more than four 120-line files with explicit names.
 * Spec: DOC-007
 * Invariants: vendored, generated, migration and fixture files are exempt (see ../lib/repo.mjs);
 *   Prisma schema files count as source.
 * Collaborators: ../lib/repo.mjs; `npm run check:filesize` runs only this check.
 * Tests: tools/doc-lint/test/docLint.code.test.mjs
 */
import { read, listFiles } from '../lib/repo.mjs';

export const id = 'DOC-007';
export const name = 'file-size';
/** The maximum number of lines per source file (DOC-007). */
export const MAX_LINES = 200;

/**
 * Checks line counts of source files and Prisma schema files.
 * @param {{root: string, files: string[]}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files }) {
  const prisma = ['apps', 'packages'].flatMap((d) => listFiles(root, d)).filter((f) => f.endsWith('.prisma'));
  return [...files, ...prisma].flatMap((file) => {
    const lines = read(root, file).replace(/\n$/, '').split('\n').length;
    return lines > MAX_LINES
      ? [{ file, line: MAX_LINES + 1, message: `${lines} lines; split it (limit ${MAX_LINES})` }]
      : [];
  });
}
