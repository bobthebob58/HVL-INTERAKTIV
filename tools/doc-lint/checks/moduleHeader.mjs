/**
 * moduleHeader — every source file opens with a header that answers what, why, spec and tests.
 *
 * Why: an evaluator opening any file must learn its purpose, its requirement and its tests within a
 *      minute (Documentation Standard, "Why this standard exists").
 * Spec: DOC-001
 * Invariants:
 *   - Source files need a summary line plus `Why:`, `Spec:` and `Tests:` labels.
 *   - Test files need a summary line plus `Spec:`; their test titles carry the rest (DOC-006).
 *   - Every requirement ID named on a `Spec:` line must exist in the specs.
 *   - Every repository path named on the `Tests:` line must exist, so the pointer can be followed.
 * Collaborators: ../lib/repo.mjs, ../docLint.mjs.
 * Tests: tools/doc-lint/test/docLint.headers.test.mjs
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isTestFile, read, ID_PATTERN } from '../lib/repo.mjs';

export const id = 'DOC-001';
export const name = 'module-header';

/**
 * Extracts the leading comment block of a file as plain text lines (comment markers removed).
 * Supports `/* … *\/` blocks (JS, TS, CSS) and `#` line comments after a shebang (shell).
 * @param {string} text - File contents.
 * @returns {string[]} Header lines, or an empty array when the file has no leading comment.
 */
export function headerLines(text) {
  const body = text.replace(/^#!.*\n/, '').replace(/^\s*\n/, '');
  if (body.startsWith('/*')) {
    const end = body.indexOf('*/');
    if (end < 0) return [];
    return body
      .slice(2, end)
      .split('\n')
      .map((l) => l.replace(/^\s*\*?\s?/, '').trimEnd());
  }
  if (body.startsWith('#')) {
    const lines = [];
    for (const l of body.split('\n')) {
      if (!l.startsWith('#')) break;
      lines.push(l.replace(/^#\s?/, '').trimEnd());
    }
    return lines;
  }
  return [];
}

/**
 * Checks the header of every source file.
 * @param {{root: string, files: string[], ids: Set<string>}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files, ids }) {
  const problems = [];
  for (const file of files) {
    const lines = headerLines(read(root, file));
    const say = (message) => problems.push({ file, line: 1, message });
    if (lines.length === 0) {
      say('missing module header (a leading comment block)');
      continue;
    }
    const summary = lines.find((l) => l.trim() !== '');
    if (!summary || /^(Why|Spec|Tests|What):/.test(summary.trim())) say('header has no summary line');
    const labels = isTestFile(file) ? ['Spec'] : ['Why', 'Spec', 'Tests'];
    for (const label of labels) {
      if (!lines.some((l) => new RegExp(`^\\s*${label}:`).test(l))) say(`header lacks a "${label}:" line`);
    }
    const specLine = lines.find((l) => /^\s*Spec:/.test(l)) ?? '';
    const named = specLine.match(ID_PATTERN) ?? [];
    if (specLine && named.length === 0) say('"Spec:" line names no requirement ID');
    for (const ref of named.filter((r) => !ids.has(r))) say(`"Spec:" names unknown requirement ${ref}`);
    for (const path of testPaths(lines).filter((p) => !existsSync(join(root, p)))) {
      say(`"Tests:" names a file that does not exist: ${path}`);
    }
  }
  return problems;
}

/**
 * Repository paths named on the `Tests:` line and its indented continuation lines.
 * @param {string[]} lines - Header lines from `headerLines`.
 * @returns {string[]} Paths such as `apps/server/test/x.test.ts`.
 */
export function testPaths(lines) {
  const start = lines.findIndex((l) => /^\s*Tests:/.test(l));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && (l.trim() === '' || /^\s*[A-Z][\w-]*:/.test(l)));
  const text = lines.slice(start, end < 0 ? undefined : end).join(' ');
  return text.match(/\b(?:apps|packages|tools|content|docs)\/[\w./-]*\w\.[a-z]+\b/g) ?? [];
}
