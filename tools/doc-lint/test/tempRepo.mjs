/**
 * tempRepo — builds small throw-away repository trees for the doc-lint tests.
 *
 * Why: each check is easiest to understand next to a tiny repository that breaks exactly one rule.
 *      Building those trees in code keeps the good and bad examples visible inside the test itself.
 * Spec: DOC-006
 * Invariants:
 *   - Every tree gets a spec file defining TST-001 and TST-002 and a DECISIONS.md defining D-001,
 *     so tests can refer to known and unknown IDs without touching the real specs.
 *   - Trees live under the OS temp directory and are removed by `removeTempRepos()`.
 * Collaborators: ../docLint.mjs (`lint`), the docLint.*.test.mjs files.
 * Tests: this helper is exercised by every docLint.*.test.mjs file.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { lint } from '../docLint.mjs';

/** A spec file that defines the two requirement IDs the tests use. */
export const TEST_SPEC =
  '#### TST-001 · MUST · S1 · First test requirement\n#### TST-002 · MUST · S1 · Second one\n';

/** A complete module header naming TST-001. */
export const GOOD_HEADER = [
  '/**',
  ' * widget — renders one widget.',
  ' *',
  ' * Why: widgets need a single place that decides how they look.',
  ' * Spec: TST-001',
  ' * Tests: written with the widget (no path, so no file has to exist)',
  ' */',
  '',
].join('\n');

/**
 * Builds one comment line carrying a rationale tag or leftover marker.
 * @param {string} tag - Tag or marker, e.g. "UPSTREAM" or "TODO(S4)".
 * @param {string} text - Text after the colon.
 * @param {string} [marker] - Comment marker, `//` by default, `#` for shell.
 * @returns {string} The comment line followed by a newline.
 *
 * WHY: writing such lines literally in a test file would make doc-lint flag the test file itself.
 */
export const comment = (tag, text, marker = '//') => `${marker} ${tag}: ${text}\n`;

/**
 * Builds one test call such as `it('[TST-001] works', () => {});`.
 * @param {string} fn - `describe`, `it` or `test`.
 * @param {string} title - Test title.
 * @returns {string} The call followed by a newline.
 *
 * WHY: a literal call with a fake ID in a test file would be read as a real test title.
 */
export const testCall = (fn, title) => `${fn}('${title}', () => {});\n`;

const created = [];

/**
 * Creates a repository tree from a map of repository-relative paths to file contents.
 * @param {Record<string, string>} files - Files to write in addition to the default spec and decisions.
 * @returns {string} Absolute path of the new tree.
 */
export function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'doc-lint-'));
  created.push(root);
  const all = {
    'docs/specs/00-test.md': TEST_SPEC,
    'docs/DECISIONS.md': '### D-001 · A decision\n',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

/**
 * Runs one named check against a tree and returns its problem messages as `file:line message`.
 * @param {string} root - Tree created by `makeRepo`.
 * @param {string} check - Check name, e.g. "module-header".
 * @returns {string[]} Problems in a compact, assertion-friendly form.
 */
export function problems(root, check) {
  return lint(root, check).map((p) => `${p.file}:${p.line} ${p.message}`);
}

/** Removes every tree created so far; call it from `afterAll`. */
export function removeTempRepos() {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
}
