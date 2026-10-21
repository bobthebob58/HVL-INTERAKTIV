/**
 * leftovers — no anonymous TODOs and no commented-out code.
 *
 * Why: an untracked TODO is a promise nobody keeps, and commented-out code makes readers guess
 *      whether it still matters. Both erode trust in the documentation.
 * Spec: DOC-013
 * Invariants:
 *   - `TODO`/`FIXME` must carry a reference in parentheses: a session (`S4`), a requirement
 *     (`UD-012`) or a URL, e.g. `TODO(S4, UD-012): …`.
 *   - Line comments that look like statements (`// const x = …;`, `// await foo();`) are rejected.
 * Collaborators: ../lib/repo.mjs.
 * Tests: tools/doc-lint/test/docLint.code.test.mjs
 */
import { extname } from 'node:path';
import { read } from '../lib/repo.mjs';

export const id = 'DOC-013';
export const name = 'leftovers';

// A marker is TODO/FIXME/XXX followed by an optional (reference) and a colon; prose mentions are ignored.
const MARKER = /\b(TODO|FIXME|XXX)(\([^)]*\))?:/;
const REFERENCE = /^\((S\d|[A-Z][A-Z0-9]*-\d{3}|https?:\/\/)/;
const CODE_IN_COMMENT =
  /^\s*\/\/\s*(const|let|var|return|if\s*\(|for\s*\(|import\s|export\s|await\s|console\.)|^\s*\/\/.*[;{]\s*$/;

/**
 * Checks for anonymous TODOs and commented-out code.
 * @param {{root: string, files: string[]}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files }) {
  const problems = [];
  for (const file of files) {
    const js = ['.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(extname(file));
    read(root, file)
      .split('\n')
      .forEach((line, i) => {
        const isComment = /^\s*(\/\/|\*|\/\*|#)/.test(line) || /\s\/\/\s/.test(line);
        const marker = isComment ? MARKER.exec(line) : null;
        if (marker && !REFERENCE.test(marker[2] ?? '')) {
          problems.push({
            file,
            line: i + 1,
            message: 'TODO without a reference, e.g. "TODO(S4, UD-012): …"',
          });
        }
        if (js && CODE_IN_COMMENT.test(line)) {
          problems.push({ file, line: i + 1, message: 'commented-out code; delete it (git keeps history)' });
        }
      });
  }
  return problems;
}
