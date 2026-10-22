/**
 * testReadability — tests name the requirement they prove, and fixture folders explain themselves.
 *
 * Why: tests are executable documentation. An evaluator searching for `[SEC-001]` must find the
 *      tests that prove it, and must be able to tell why each fixture exists.
 * Spec: DOC-006
 * Invariants:
 *   - Every test file has at least one running it()/test() title that opens with a requirement ID in
 *     brackets, and every bracketed ID opening any describe/it/test title exists.
 *   - Every directory named `fixtures` contains a README.md.
 * Collaborators: ../lib/repo.mjs, ../../spec-trace/testTitles.mjs (the title rule shared with spec-trace).
 * Tests: tools/doc-lint/test/docLint.repo.test.mjs
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isTestFile, listFiles, read, SOURCE_ROOTS } from '../lib/repo.mjs';
import { leadingIds, testTitles } from '../../spec-trace/testTitles.mjs';

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
    // WHY: the same rule as tools/spec-trace (D-033): only a running it()/test() title proves a requirement.
    if (!titles.some((t) => t.active && t.fn !== 'describe' && leadingIds(t.title).length > 0)) {
      problems.push({
        file,
        line: 1,
        message: 'no running it()/test() title starts with "[<requirement ID>] "',
      });
    }
    for (const ref of titles.flatMap((t) => leadingIds(t.title)).filter((r) => !ids.has(r))) {
      problems.push({ file, line: 1, message: `test title names unknown requirement ${ref}` });
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
