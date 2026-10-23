/**
 * testReadability — tests name the requirement they prove, and fixture folders explain themselves.
 *
 * Why: tests are executable documentation. An evaluator searching for `[SEC-001]` must find the
 *      tests that prove it, and must be able to tell why each fixture exists.
 * Spec: DOC-006
 * Invariants:
 *   - Every test file has at least one running it()/test() title that opens with a requirement ID in
 *     brackets, unless all its running titles open with `upstream pin: ` (DOC-004); every bracketed ID
 *     opening any describe/it/test title exists.
 *   - An it()/test() whose function body is longer than 10 lines has comments inside that body that name its
 *     Act and Assert steps (`// Act`, `// Assert`, or `// Act and assert`), as DOC-006 asks. Tables of
 *     `it.each` and the title do not count as body lines.
 *   - Every directory named `fixtures` contains a README.md.
 * Collaborators: ../lib/repo.mjs, ../../spec-trace/testTitles.mjs (the title rule shared with spec-trace).
 * Tests: tools/doc-lint/test/docLint.code.test.mjs
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isTestFile, listFiles, read, SOURCE_ROOTS } from '../lib/repo.mjs';
import { blankLiterals, leadingIds, testTitles } from '../../spec-trace/testTitles.mjs';

const UPSTREAM_PIN = /^upstream pin: /;
const MAX_UNMARKED_BODY_LINES = 10;

const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

/**
 * The `{` and `}` of the test function's body: the last block before the call's closing parenthesis.
 * @param {string} code - The file with comments and literals blanked.
 * @param {{start: number, end: number}} call - Offsets of the it()/test() call.
 * @returns {[number, number] | undefined} Offsets of the braces, or undefined for a call without a body.
 */
function bodyOf(code, call) {
  const close = code.lastIndexOf('}', call.end);
  if (close <= call.start) return undefined;
  let depth = 0;
  for (let i = close; i > call.start; i -= 1) {
    if (code[i] === '}') depth += 1;
    else if (code[i] === '{' && --depth === 0) return [i, close];
  }
  return undefined;
}

/**
 * The tests in a file whose body is longer than 10 lines but whose comments do not name Act and Assert.
 * @param {string} text - Contents of a test file.
 * @returns {{line: number, lines: number}[]} The first line and the body length of each such test.
 */
function unmarkedLongTests(text) {
  const { code, comments } = blankLiterals(text);
  const found = [];
  for (const t of testTitles(text).filter((c) => c.fn !== 'describe')) {
    // WHY: only the function body counts; an it.each table or a long title is not the test's steps.
    const body = bodyOf(code, t);
    if (!body) continue;
    const lines = lineOf(text, body[1]) - lineOf(text, body[0]) - 1;
    if (lines <= MAX_UNMARKED_BODY_LINES) continue;
    const inside = comments.filter((c) => c.start > body[0] && c.start < body[1]).map((c) => c.text);
    const names = (word) => inside.some((c) => new RegExp(`\\b${word}\\b`, 'i').test(c));
    if (!names('act') || !names('assert')) found.push({ line: lineOf(text, t.start), lines });
  }
  return found;
}

export const id = 'DOC-006';
export const name = 'test-readability';

/**
 * Checks test titles and fixture READMEs.
 * @param {{root: string, files: string[], ids: Set<string>}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files, ids }) {
  const problems = [];
  for (const file of files.filter(isTestFile)) {
    const titles = testTitles(read(root, file));
    const running = titles.filter((t) => t.active && t.fn !== 'describe');
    // WHY: a pin of an upstream bug passes while the upstream code is unsafe, so it proves no requirement.
    const pinsOnly = running.length > 0 && running.every((t) => UPSTREAM_PIN.test(t.title));
    // WHY: the same rule as tools/spec-trace (D-033): only a running it()/test() title proves a requirement.
    if (!pinsOnly && !running.some((t) => leadingIds(t.title).length > 0)) {
      problems.push({
        file,
        line: 1,
        message: 'no running it()/test() title starts with "[<requirement ID>] "',
      });
    }
    for (const ref of titles.flatMap((t) => leadingIds(t.title)).filter((r) => !ids.has(r))) {
      problems.push({ file, line: 1, message: `test title names unknown requirement ${ref}` });
    }
    for (const { line, lines } of unmarkedLongTests(read(root, file))) {
      problems.push({
        file,
        line,
        message: `test body of ${lines} lines needs "// Act" and "// Assert" comments`,
      });
    }
  }
  const all = SOURCE_ROOTS.flatMap((d) => listFiles(root, d));
  const fixtureDirs = new Set(
    all
      .filter((f) => f.includes('/fixtures/'))
      .map((f) => f.slice(0, f.indexOf('/fixtures/') + '/fixtures'.length)),
  );
  for (const dir of fixtureDirs) {
    if (!existsSync(join(root, dir, 'README.md'))) {
      problems.push({
        file: dir,
        line: 1,
        message: 'fixture folder has no README.md explaining each fixture',
      });
    }
  }
  return problems;
}
