/**
 * docLint — runs every Documentation Standard check and reports problems as `file:line message`.
 *
 * Why: the standard only holds if a machine checks it on every commit and in CI; review alone
 *      lets documentation drift.
 * Spec: DOC-001
 * Invariants:
 *   - Exit code 1 when any check reports a problem, 0 otherwise.
 *   - `--only=<name>` runs a single check (e.g. `--only=file-size` for `npm run check:filesize`).
 *   - `--root=<dir>` lints another tree (used by the tests).
 * Collaborators: ./checks/*.mjs (one rule each), ./lib/repo.mjs.
 * Tests: tools/doc-lint/test/docLint.headers.test.mjs and the other docLint.*.test.mjs files.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sourceFiles, knownRequirementIds } from './lib/repo.mjs';
import * as moduleHeader from './checks/moduleHeader.mjs';
import * as exportDocs from './checks/exportDocs.mjs';
import * as rationaleTags from './checks/rationaleTags.mjs';
import * as packageReadme from './checks/packageReadme.mjs';
import * as testReadability from './checks/testReadability.mjs';
import * as fileSize from './checks/fileSize.mjs';
import * as envDocumented from './checks/envDocumented.mjs';
import * as localeParity from './checks/localeParity.mjs';
import * as deviations from './checks/deviations.mjs';
import * as leftovers from './checks/leftovers.mjs';
import * as contentGuides from './checks/contentGuides.mjs';

/** Every check, in the order of the Documentation Standard. */
export const CHECKS = [
  moduleHeader,
  exportDocs,
  rationaleTags,
  packageReadme,
  testReadability,
  fileSize,
  envDocumented,
  localeParity,
  deviations,
  leftovers,
  contentGuides,
];

/**
 * Runs the selected checks against a repository tree.
 * @param {string} root - Absolute repository root.
 * @param {string} [only] - Name of a single check to run.
 * @returns {{check: string, id: string, file: string, line: number, message: string}[]} All problems.
 */
export function lint(root, only) {
  const ctx = { root, files: sourceFiles(root), ids: knownRequirementIds(root) };
  return CHECKS.filter((c) => !only || c.name === only).flatMap((c) =>
    c.run(ctx).map((p) => ({ check: c.name, id: c.id, ...p })),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (key) => process.argv.find((a) => a.startsWith(`--${key}=`))?.split('=')[1];
  const root = resolve(arg('root') ?? fileURLToPath(new URL('../../', import.meta.url)));
  const problems = lint(root, arg('only'));
  for (const p of problems) console.error(`✗ ${p.file}:${p.line} [${p.id} ${p.check}] ${p.message}`);
  if (problems.length > 0) process.exit(1);
  console.log(`✓ doc-lint: ${arg('only') ?? `${CHECKS.length} checks`} passed.`);
}
