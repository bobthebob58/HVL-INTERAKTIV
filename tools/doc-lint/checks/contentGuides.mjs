/**
 * contentGuides — every folder of non-developer-editable content explains how to edit it.
 *
 * Why: ALU staff edit patterns, guide texts and portfolio templates in `content/` without touching
 *      code; each folder needs a plain-language guide with an example and the tests that catch mistakes.
 * Spec: DOC-014
 * Invariants: `content/README.md` and `content/<folder>/README.md` must exist once `content/` exists.
 * Collaborators: ../lib/repo.mjs.
 * Tests: tools/doc-lint/test/docLint.repo.test.mjs
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const id = 'DOC-014';
export const name = 'content-guides';

/**
 * Checks README presence in `content/` and each of its folders.
 * @param {{root: string}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root }) {
  const base = join(root, 'content');
  if (!existsSync(base)) return [];
  const dirs = [
    'content',
    ...readdirSync(base)
      .filter((d) => statSync(join(base, d)).isDirectory())
      .map((d) => `content/${d}`),
  ];
  return dirs
    .filter((d) => !existsSync(join(root, d, 'README.md')))
    .map((d) => ({ file: d, line: 1, message: 'missing README.md for the people who edit this content' }));
}
