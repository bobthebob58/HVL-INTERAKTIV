/**
 * repo — file discovery and requirement-ID lookup shared by every doc-lint check.
 *
 * Why: all checks must agree on which files are "source files" and which requirement IDs exist,
 *      otherwise one check could pass a file another check rejects.
 * Spec: DOC-001
 * Invariants:
 *   - Vendored, generated and fetched third-party files are never checked (they are not ours).
 *   - Requirement IDs are read with the same heading pattern as tools/spec-trace.
 * Collaborators: every module in ../checks, ../docLint.mjs.
 * Tests: tools/doc-lint/test/docLint.headers.test.mjs (exercised through the checks).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/** Directories that hold our own code and therefore must follow the Documentation Standard. */
export const SOURCE_ROOTS = ['apps', 'packages', 'tools'];
/** File extensions treated as source code. */
export const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.sh']);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  'vendor',
  'generated',
  'migrations',
  'var',
]);
// WHY: apps/server/h5p holds H5P's own core and editor files, fetched and hash-verified (D-027).
const SKIP_PATHS = ['apps/server/h5p/'];

/**
 * Lists every file under `dir` (repository-relative), skipping build output and third-party code.
 * @param {string} root - Absolute repository root.
 * @param {string} dir - Repository-relative directory.
 * @returns {string[]} Sorted repository-relative paths.
 */
export function listFiles(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
  return readdirSync(abs, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (SKIP_DIRS.has(entry.name) || SKIP_PATHS.some((p) => `${rel}/`.startsWith(p))) return [];
      return entry.isDirectory() ? listFiles(root, rel) : [rel];
    })
    .sort();
}

/**
 * Lists our own source files, excluding test fixtures (which may be broken on purpose).
 * @param {string} root - Absolute repository root.
 * @returns {string[]} Repository-relative paths.
 */
export function sourceFiles(root) {
  return SOURCE_ROOTS.flatMap((d) => listFiles(root, d)).filter(
    (f) => SOURCE_EXTENSIONS.has(extname(f)) && !f.includes('/fixtures/'),
  );
}

/** True for test files, which follow lighter header rules but must name requirements. */
export const isTestFile = (file) => /\.(test|spec|int\.test)\.[cm]?[jt]sx?$/.test(file);

/**
 * Reads a repository file as UTF-8 text.
 * @param {string} root - Absolute repository root.
 * @param {string} file - Repository-relative path.
 */
export const read = (root, file) => readFileSync(join(root, file), 'utf8');

/**
 * Collects every requirement ID defined in docs/specs and the Documentation Standard.
 * @param {string} root - Absolute repository root.
 * @returns {Set<string>} IDs such as "SEC-001".
 */
export function knownRequirementIds(root) {
  const ids = new Set();
  const sources = [...listFiles(root, 'docs/specs'), 'docs/DOCUMENTATION-STANDARD.md'];
  for (const file of sources.filter((f) => f.endsWith('.md') && existsSync(join(root, f)))) {
    for (const m of read(root, file).matchAll(/^#### ([A-Z][A-Z0-9]*-\d{3}) · /gm)) ids.add(m[1]);
  }
  return ids;
}

/** Matches requirement-shaped tokens such as "H5P-001". */
export const ID_PATTERN = /\b[A-Z][A-Z0-9]{1,5}-\d{3}\b/g;
