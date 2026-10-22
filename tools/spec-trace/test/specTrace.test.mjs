/**
 * Tests for the traceability tool, run as a child process against small temporary trees.
 *
 * Spec: DOC-004
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, removeTempRepos, testCall, GOOD_HEADER } from '../../doc-lint/test/tempRepo.mjs';

afterAll(removeTempRepos);

const SCRIPT = fileURLToPath(new URL('../specTrace.mjs', import.meta.url));
const TEST_HEADER = '/**\n * Tests for widget.\n *\n * Spec: TST-001\n */\n';
const TESTED = TEST_HEADER + testCall('it', '[TST-001] one') + testCall('it', '[TST-002] two');

/** Runs specTrace on a tree and returns its exit code and combined output. */
function trace(root, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, SPEC_TRACE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('[DOC-004] traceability matrix', () => {
  it('[DOC-004] links each requirement to the code and tests that name it', () => {
    const root = makeRepo({
      'tools/w/w.mjs': GOOD_HEADER,
      'tools/w/test/w.test.mjs': TEST_HEADER + testCall('it', '[TST-001] one'),
    });
    expect(trace(root).code).toBe(0);
    const matrix = readFileSync(join(root, 'docs/TRACEABILITY.md'), 'utf8');
    expect(matrix).toContain(
      '| TST-001 | MUST | S1 | First test requirement | `tools/w/w.mjs` | `tools/w/test/w.test.mjs` | tested |',
    );
    expect(matrix).toContain('| TST-002 | MUST | S1 | Second one | — | — | planned |');
  });

  it('[DOC-004] is deterministic and --check passes right after regeneration', () => {
    const root = makeRepo({ 'tools/w/test/w.test.mjs': TESTED });
    trace(root);
    const first = readFileSync(join(root, 'docs/TRACEABILITY.md'), 'utf8');
    trace(root);
    expect(readFileSync(join(root, 'docs/TRACEABILITY.md'), 'utf8')).toBe(first);
    expect(trace(root, '--check')).toMatchObject({ code: 0 });
  });

  it('[DOC-004] --check fails when the matrix is stale', () => {
    const root = makeRepo({ 'tools/w/test/w.test.mjs': TESTED });
    trace(root);
    writeFileSync(join(root, 'docs/TRACEABILITY.md'), '# edited by hand\n');
    const r = trace(root, '--check');
    expect(r.code).toBe(1);
    expect(r.out).toContain('docs/TRACEABILITY.md is out of date');
  });

  it('[DOC-004] --check fails on duplicate requirement IDs', () => {
    const root = makeRepo({
      'docs/specs/01-more.md': '#### TST-001 · SHOULD · S2 · A clash\n',
      'tools/w/test/w.test.mjs': TESTED,
    });
    trace(root);
    const r = trace(root, '--check');
    expect(r.code).toBe(1);
    expect(r.out).toContain('duplicate requirement ID TST-001 in docs/specs/01-more.md');
  });

  it('[DOC-004] --check fails on references to requirements that no spec defines', () => {
    const root = makeRepo({
      'docs/notes.md': 'See TST-404 for details.\n',
      'tools/w/test/w.test.mjs': TESTED,
    });
    trace(root);
    const r = trace(root, '--check');
    expect(r.code).toBe(1);
    expect(r.out).toContain('docs/notes.md:1 references unknown requirement TST-404');
  });

  it('[DOC-004] --done-through=S1 fails while an S1 MUST requirement has no test', () => {
    const untested = makeRepo({ 'tools/w/test/w.test.mjs': TEST_HEADER + testCall('it', '[TST-001] one') });
    trace(untested);
    const r = trace(untested, '--check', '--done-through=S1');
    expect(r.code).toBe(1);
    expect(r.out).toContain('TST-002 (MUST, S1) has no test whose title contains [TST-002]');

    const tested = makeRepo({ 'tools/w/test/w.test.mjs': TESTED });
    trace(tested);
    expect(trace(tested, '--check', '--done-through=S1').code).toBe(0);
  });

  it('[DOC-004] counts an ID only when it opens an it() or test() title', () => {
    const notReally =
      TEST_HEADER +
      '// covers [TST-002] one day\n' +
      testCall('describe', '[TST-002] group only') +
      testCall('it.skip', '[TST-002] skipped') +
      testCall('it', '[TST-001] real');
    const root = makeRepo({ 'tools/w/test/w.test.mjs': notReally });
    trace(root);
    const r = trace(root, '--check', '--done-through=S1');
    expect(r.code).toBe(1);
    expect(r.out).toContain('TST-002 (MUST, S1) has no test whose title contains [TST-002]');
    expect(r.out).not.toContain('TST-001 (MUST, S1)');
  });

  it('[DOC-004] ignores the fetched H5P core files', () => {
    const root = makeRepo({
      'apps/server/h5p/core/js/h5p.js': '// TST-404\n',
      'tools/w/test/w.test.mjs': TESTED,
    });
    trace(root);
    expect(trace(root, '--check').code).toBe(0);
  });
});
