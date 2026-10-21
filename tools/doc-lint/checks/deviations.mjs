/**
 * deviations — every `SPEC-DEVIATION:` in code points to a decision that exists.
 *
 * Why: a deviation from the spec is acceptable only when it is recorded and reasoned in
 *      docs/DECISIONS.md; a dangling reference would hide an unreviewed change.
 * Spec: DOC-010
 * Invariants: decisions are recognised by their `### D-xxx` headings in docs/DECISIONS.md.
 * Collaborators: ../lib/repo.mjs; ./rationaleTags.mjs checks the tag's wording (DOC-003).
 * Tests: tools/doc-lint/test/docLint.code.test.mjs
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { read } from '../lib/repo.mjs';

export const id = 'DOC-010';
export const name = 'deviations';

/**
 * Checks that referenced decisions exist.
 * @param {{root: string, files: string[]}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files }) {
  const decisionsFile = 'docs/DECISIONS.md';
  const known = existsSync(join(root, decisionsFile))
    ? new Set([...read(root, decisionsFile).matchAll(/^### (D-\d{3})\b/gm)].map((m) => m[1]))
    : new Set();
  const problems = [];
  for (const file of files) {
    read(root, file)
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(/SPEC-DEVIATION:.*?\b(D-\d{3})\b/g)) {
          if (!known.has(m[1])) {
            problems.push({
              file,
              line: i + 1,
              message: `SPEC-DEVIATION names ${m[1]}, which is not in ${decisionsFile}`,
            });
          }
        }
      });
  }
  return problems;
}
