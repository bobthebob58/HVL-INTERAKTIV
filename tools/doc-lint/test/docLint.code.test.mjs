/**
 * Tests for the code-shape checks: readable tests, file size and leftovers.
 *
 * Spec: DOC-006, DOC-007, DOC-013
 */
import { describe, it, expect, afterAll } from 'vitest';
import { makeRepo, problems, removeTempRepos, comment, testCall, GOOD_HEADER } from './tempRepo.mjs';

afterAll(removeTempRepos);

const TEST_HEADER = '/**\n * Tests for widget.\n *\n * Spec: TST-001\n */\n';

describe('[DOC-006] test titles and fixtures', () => {
  it('[DOC-006] accepts a test file whose titles start with a known requirement ID', () => {
    const test =
      TEST_HEADER + testCall('describe', '[TST-001] widget') + testCall('it.each([1])', '[TST-002] case %i');
    const root = makeRepo({ 'apps/server/test/widget.test.ts': test });
    expect(problems(root, 'test-readability')).toEqual([]);
  });

  it('[DOC-006] rejects a test file without any [ID] title', () => {
    const root = makeRepo({ 'apps/server/test/widget.test.ts': TEST_HEADER + testCall('it', 'works') });
    expect(problems(root, 'test-readability')).toEqual([
      'apps/server/test/widget.test.ts:1 no running it()/test() title starts with "[<requirement ID>] "',
    ]);
  });

  it('[DOC-006] accepts a file of upstream pins without IDs, but not pins mixed with untagged tests', () => {
    const pins = TEST_HEADER + testCall('it', 'upstream pin: Lumi skips list items');
    expect(problems(makeRepo({ 'apps/server/test/upstream/a.test.ts': pins }), 'test-readability')).toEqual(
      [],
    );
    const mixed = pins + testCall('it', 'works');
    expect(problems(makeRepo({ 'apps/server/test/upstream/b.test.ts': mixed }), 'test-readability')).toEqual([
      'apps/server/test/upstream/b.test.ts:1 no running it()/test() title starts with "[<requirement ID>] "',
    ]);
  });

  it('[DOC-006] a test body over 10 lines must name its Act and Assert steps in comments', () => {
    const body = (comments) =>
      `${TEST_HEADER}it('[TST-001] long', () => {\n${comments}${'  expect(1).toBe(1);\n'.repeat(11)}});\n`;
    const check = (text) => problems(makeRepo({ 'apps/server/test/long.test.ts': text }), 'test-readability');
    expect(check(body(''))).toEqual([
      'apps/server/test/long.test.ts:6 test body of 11 lines needs "// Act" and "// Assert" comments',
    ]);
    // WHY: words inside strings are not comments; "Act" alone or "assert" alone is not enough either.
    expect(check(body("  const url = 'https://x.example/act/assert';\n  // Arrange and act\n"))).toHaveLength(
      1,
    );
    expect(check(body('  // Act and assert\n'))).toEqual([]);
    expect(check(body('  // Arrange\n  // Act\n  /* Assert */\n'))).toEqual([]);
    const short = `${TEST_HEADER}it('[TST-001] short', () => {\n${'  expect(1).toBe(1);\n'.repeat(10)}});\n`;
    expect(check(short)).toEqual([]);
  });

  it('[DOC-006] rejects titles that name unknown requirements', () => {
    const root = makeRepo({ 'tools/w/test/w.test.mjs': TEST_HEADER + testCall('test', '[TST-777] ghost') });
    expect(problems(root, 'test-readability')).toEqual([
      'tools/w/test/w.test.mjs:1 test title names unknown requirement TST-777',
    ]);
  });

  it('[DOC-006] requires a README in every fixture folder', () => {
    const root = makeRepo({
      'apps/server/test/fixtures/evil.zip': 'zip',
      'tools/w/test/fixtures/README.md': '# Fixtures\n',
      'tools/w/test/fixtures/bad.mjs': 'broken on purpose',
    });
    expect(problems(root, 'test-readability')).toEqual([
      'apps/server/test/fixtures:1 fixture folder has no README.md explaining each fixture',
    ]);
  });
});

describe('[DOC-007] file size', () => {
  const lines = (n) => `${GOOD_HEADER}${'x;\n'.repeat(n - 7)}`;

  it('[DOC-007] accepts exactly 200 lines', () => {
    const root = makeRepo({ 'tools/w/w.mjs': lines(200) });
    expect(problems(root, 'file-size')).toEqual([]);
  });

  it('[DOC-007] rejects 201 lines and points at the first line over the limit', () => {
    const root = makeRepo({ 'tools/w/w.mjs': lines(201) });
    expect(problems(root, 'file-size')).toEqual(['tools/w/w.mjs:201 201 lines; split it (limit 200)']);
  });

  it('[DOC-007] also limits Prisma schema files', () => {
    const root = makeRepo({ 'apps/server/prisma/schema/big.prisma': '//\n'.repeat(250) });
    expect(problems(root, 'file-size')).toEqual([
      'apps/server/prisma/schema/big.prisma:201 250 lines; split it (limit 200)',
    ]);
  });

  it('[DOC-007] ignores generated code and migrations', () => {
    const root = makeRepo({
      'apps/server/src/generated/prisma/client.ts': '//\n'.repeat(500),
      'apps/server/prisma/migrations/0001_init/migration.sql': '--\n'.repeat(500),
    });
    expect(problems(root, 'file-size')).toEqual([]);
  });
});

describe('[DOC-013] leftovers', () => {
  it('[DOC-013] accepts markers that reference a session, requirement or URL', () => {
    const code =
      GOOD_HEADER +
      comment('TODO(S4, UD-012)', 'add the timeline view.') +
      comment('FIXME(TST-001)', 'handle empty input.') +
      comment('TODO(https://github.com/x/y/issues/2)', 'remove once fixed.', '#');
    const root = makeRepo({ 'tools/w/w.mjs': code });
    expect(problems(root, 'leftovers')).toEqual([]);
  });

  it('[DOC-013] rejects anonymous markers', () => {
    const code = GOOD_HEADER + comment('TODO', 'clean this up') + comment('FIXME(soon)', 'later');
    const root = makeRepo({ 'tools/w/w.mjs': code });
    expect(problems(root, 'leftovers')).toEqual([
      'tools/w/w.mjs:8 TODO without a reference, e.g. "TODO(S4, UD-012): …"',
      'tools/w/w.mjs:9 TODO without a reference, e.g. "TODO(S4, UD-012): …"',
    ]);
  });

  it('[DOC-013] ignores the word in prose and in code', () => {
    const code = `${GOOD_HEADER}// The TODO list view is built in S4.\nconst todoCount = 0;\n`;
    const root = makeRepo({ 'tools/w/w.mjs': code });
    expect(problems(root, 'leftovers')).toEqual([]);
  });

  it('[DOC-013] rejects commented-out code but keeps explanatory comments', () => {
    const code = `${GOOD_HEADER}// const old = compute();\n//   await flush()\n// Retries three times before giving up.\n`;
    const root = makeRepo({ 'apps/server/src/w.ts': code });
    expect(problems(root, 'leftovers')).toEqual([
      'apps/server/src/w.ts:8 commented-out code; delete it (git keeps history)',
      'apps/server/src/w.ts:9 commented-out code; delete it (git keeps history)',
    ]);
  });
});
