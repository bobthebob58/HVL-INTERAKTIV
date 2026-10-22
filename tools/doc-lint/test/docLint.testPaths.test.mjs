/**
 * Tests for the paths named on a module header's `Tests:` line: every form must point to something real.
 *
 * Spec: DOC-001
 */
import { describe, it, expect, afterAll } from 'vitest';
import { testPaths } from '../checks/moduleHeader.mjs';
import { makeRepo, problems, removeTempRepos, GOOD_HEADER } from './tempRepo.mjs';

afterAll(removeTempRepos);

const NO_PATH = 'Tests: written with the widget (no path, so no file has to exist)';
const TEST_HEADER = '/**\n * Tests for the widget.\n *\n * Spec: TST-001\n */\n';
const EXISTING = {
  'apps/server/test/h5p/widget.test.ts': TEST_HEADER,
  'apps/server/test/h5p/store.int.test.ts': TEST_HEADER,
};

/** Lints `apps/server/src/widget.ts` whose `Tests:` line is `tests`, next to two real test files. */
const lintTestsLine = (tests) =>
  problems(
    makeRepo({ ...EXISTING, 'apps/server/src/widget.ts': GOOD_HEADER.replace(NO_PATH, `Tests: ${tests}`) }),
    'module-header',
  );

describe('[DOC-001] paths on the Tests: line', () => {
  it('[DOC-001] accepts repository-rooted, package-relative, directory and glob paths that exist', () => {
    expect(
      lintTestsLine(
        'apps/server/test/h5p/widget.test.ts, test/h5p/store.int.test.ts, ../test/h5p/widget.test.ts,\n' +
          ' *   apps/server/test/, test/h5p/*.test.ts, every *.int.test.ts file and widget.test.ts.',
      ),
    ).toEqual([]);
  });

  it('[DOC-001] rejects each form when it points to nothing', () => {
    const missing = [
      'test/gone.test.ts',
      './test/gone.test.ts',
      'e2e/gone.spec.ts',
      'apps/server/test/nothere/',
      'apps/server/test/nothere/*.test.ts',
      'gone.test.ts',
    ];
    expect(lintTestsLine(missing.join(', '))).toEqual(
      missing.map((path) => `apps/server/src/widget.ts:1 "Tests:" names a path that does not exist: ${path}`),
    );
  });

  it('[DOC-001] reads only path-like words, ignoring prose and URLs', () => {
    expect(
      testPaths([
        'Tests: run by `npm run lint` in CI; see https://example.org/x.ts and',
        '  tools/x/test/y.test.mjs (integration).',
        'Collaborators: not/a/test.ts',
      ]),
    ).toEqual(['tools/x/test/y.test.mjs']);
  });
});
