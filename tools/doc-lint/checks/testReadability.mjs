/**
 * testReadability — tests name the requirement they prove, and fixture folders explain themselves.
 *
 * Why: tests are executable documentation. An evaluator searching for `[SEC-001]` must find the
 *      tests that prove it, and must be able to tell why each fixture exists.
 * Spec: DOC-006
 * Invariants:
 *   - Every test file has at least one test title containing a known requirement ID in brackets.
 *   - Every directory named `fixtures` contains a README.md.
 * Collaborators: ../lib/repo.mjs; tools/spec-trace reads the same bracketed IDs.
 * Tests: tools/doc-lint/test/docLint.repo.test.mjs
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isTestFile, listFiles, read, SOURCE_ROOTS } from '../lib/repo.mjs';

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
    const titled = [
      ...read(root, file).matchAll(/\b(?:describe|it|test)(?:\.\w+)*\(\s*['"`]\[([A-Z][A-Z0-9]*-\d{3})\]/g),
    ];
    if (titled.length === 0) {
      problems.push({ file, line: 1, message: 'no test title starts with "[<requirement ID>] "' });
    }
    for (const m of titled.filter((t) => !ids.has(t[1]))) {
      problems.push({ file, line: 1, message: `test title names unknown requirement ${m[1]}` });
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
