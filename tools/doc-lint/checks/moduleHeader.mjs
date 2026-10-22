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
 *   - Every path named on the `Tests:` line must exist, so the pointer can be followed: repository-rooted,
 *     package-relative (`test/x.test.ts`) and file-relative (`./x`) paths, directories, and globs, which
 *     must match at least one file. A bare name or glob without `/` may match anywhere in the package.
 * Collaborators: ../lib/repo.mjs, ../docLint.mjs.
 * Tests: tools/doc-lint/test/docLint.headers.test.mjs, tools/doc-lint/test/docLint.testPaths.test.mjs
 */
import { existsSync, globSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isTestFile, read, ID_PATTERN, SOURCE_ROOTS } from '../lib/repo.mjs';

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
    for (const path of testPaths(lines).filter((p) => !pathExists(root, file, p))) {
      say(`"Tests:" names a path that does not exist: ${path}`);
    }
  }
  return problems;
}

/** File extensions that make a word without `/` a path (`h5pServerInit.test.ts`, `*.int.test.ts`). */
const PATH_EXTENSION = /\.(?:[cm]?[jt]sx?|sh|md|json|css|prisma|ya?ml)$/;

/**
 * Path-like words on the `Tests:` line and its indented continuation lines.
 * @param {string[]} lines - Header lines from `headerLines`.
 * @returns {string[]} Words with a `/` or a file extension, e.g. `apps/server/test/x.test.ts`, `test/h5p/`.
 */
export function testPaths(lines) {
  const start = lines.findIndex((l) => /^\s*Tests:/.test(l));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && (l.trim() === '' || /^\s*[A-Z][\w-]*:/.test(l)));
  const text = lines
    .slice(start, end < 0 ? undefined : end)
    .join(' ')
    .replace(/^\s*Tests:/, '');
  return text
    .split(/[\s,()`'"]+/)
    .map((word) => word.replace(/[.;:]+$/, ''))
    .filter((word) => !word.includes('://') && /[\w*]/.test(word))
    .filter((word) => word.includes('/') || PATH_EXTENSION.test(word));
}

/**
 * The package a file belongs to: `apps/server` for `apps/server/src/x.ts`, the repository root otherwise.
 * @param {string} file - Repository-relative path.
 * @returns {string} Repository-relative package directory, or `.`.
 */
const packageOf = (file) => {
  const parts = file.split('/');
  return SOURCE_ROOTS.includes(parts[0]) && parts.length > 2 ? parts.slice(0, 2).join('/') : '.';
};

const skipDependencies = (entry) =>
  basename(typeof entry === 'string' ? entry : entry.name) === 'node_modules';

/**
 * Tells whether a path named on a `Tests:` line points to something that exists.
 * @param {string} root - Absolute repository root.
 * @param {string} file - Repository-relative path of the file whose header names it.
 * @param {string} path - A word from `testPaths`.
 * @returns {boolean} True for an existing file or directory, or a glob with at least one match.
 */
export function pathExists(root, file, path) {
  const inPackage = join(root, packageOf(file));
  const [bases, pattern] = path.includes('/')
    ? [[root, inPackage, join(root, dirname(file))], path]
    : [[inPackage], `**/${path}`];
  return bases.some((cwd) =>
    pattern.includes('*')
      ? globSync(pattern, { cwd, exclude: skipDependencies }).length > 0
      : existsSync(join(cwd, pattern)),
  );
}
