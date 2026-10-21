/**
 * exportDocs — every exported TypeScript symbol has a TSDoc comment, and `@spec` tags are real.
 *
 * Why: callers (and reviewers) learn how to use a function from its TSDoc, not by reading its body.
 *      ESLint's jsdoc rule catches most cases; this check also validates `@spec` IDs and covers
 *      `export const`, which ESLint's rule does not.
 * Spec: DOC-002
 * Invariants: only `.ts`/`.tsx` files outside tests are checked; re-export lists are ignored.
 * Collaborators: ../lib/repo.mjs, eslint.config.mjs (jsdoc/require-jsdoc).
 * Tests: tools/doc-lint/test/docLint.code.test.mjs
 */
import { isTestFile, read } from '../lib/repo.mjs';

export const id = 'DOC-002';
export const name = 'export-docs';

const EXPORT_DECL =
  /^export\s+(default\s+)?(declare\s+)?(async\s+)?(abstract\s+)?(function\*?|class|const|let|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;

/**
 * Checks TSDoc presence on exports and the validity of `@spec` tags.
 * @param {{root: string, files: string[], ids: Set<string>}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files, ids }) {
  const problems = [];
  for (const file of files.filter((f) => /\.tsx?$/.test(f) && !isTestFile(f))) {
    const lines = read(root, file).split('\n');
    // WHY: the module header is not the doc comment of the first export directly below it.
    const headerEnd = lines[0]?.startsWith('/*') ? lines.findIndex((l) => /\*\/\s*$/.test(l)) : -1;
    lines.forEach((line, i) => {
      const m = EXPORT_DECL.exec(line);
      if (m) {
        let j = i - 1;
        while (j >= 0 && /^\s*@\w/.test(lines[j])) j--; // skip decorators
        if (j < 0 || j === headerEnd || !/\*\/\s*$/.test(lines[j])) {
          problems.push({ file, line: i + 1, message: `exported ${m[5]} "${m[6]}" has no TSDoc comment` });
        }
      }
      for (const tag of line.matchAll(/@spec\s+([A-Z][A-Z0-9]*-\d{3})/g)) {
        if (!ids.has(tag[1])) problems.push({ file, line: i + 1, message: `@spec names unknown ${tag[1]}` });
      }
    });
  }
  return problems;
}
