/**
 * Tests for the header and comment checks: module headers, TSDoc on exports and rationale tags.
 *
 * Spec: DOC-001, DOC-002, DOC-003
 */
import { describe, it, expect, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { lint } from '../docLint.mjs';
import { headerLines } from '../checks/moduleHeader.mjs';
import { makeRepo, problems, removeTempRepos, comment, testCall, GOOD_HEADER } from './tempRepo.mjs';

afterAll(removeTempRepos);

describe('[DOC-001] module headers', () => {
  it('[DOC-001] accepts a header with summary, Why, Spec and Tests', () => {
    const root = makeRepo({ 'tools/widget/widget.mjs': `${GOOD_HEADER}export const x = 1;\n` });
    expect(problems(root, 'module-header')).toEqual([]);
  });

  it('[DOC-001] rejects a file without any leading comment', () => {
    const root = makeRepo({ 'apps/web/src/page.ts': 'export const x = 1;\n' });
    expect(problems(root, 'module-header')).toEqual([
      'apps/web/src/page.ts:1 missing module header (a leading comment block)',
    ]);
  });

  it('[DOC-001] rejects a Tests: line that points to a file that does not exist', () => {
    const header = GOOD_HEADER.replace(
      'Tests: written with the widget (no path, so no file has to exist)',
      'Tests: docs/specs/00-test.md and\n *   tools/widget/test/gone.int.test.mjs (integration)',
    );
    const root = makeRepo({ 'tools/widget/widget.mjs': header });
    expect(problems(root, 'module-header')).toEqual([
      'tools/widget/widget.mjs:1 "Tests:" names a file that does not exist: tools/widget/test/gone.int.test.mjs',
    ]);
  });

  it('[DOC-001] names each missing label', () => {
    const header = '/**\n * widget — renders one widget.\n * Spec: TST-001\n */\n';
    const root = makeRepo({ 'tools/widget/widget.mjs': header });
    expect(problems(root, 'module-header')).toEqual([
      'tools/widget/widget.mjs:1 header lacks a "Why:" line',
      'tools/widget/widget.mjs:1 header lacks a "Tests:" line',
    ]);
  });

  it('[DOC-001] rejects a header that starts with a label instead of a summary', () => {
    const header = '/**\n * Why: no summary first.\n * Spec: TST-001\n * Tests: none yet\n */\n';
    const root = makeRepo({ 'tools/widget/widget.mjs': header });
    expect(problems(root, 'module-header')).toContain('tools/widget/widget.mjs:1 header has no summary line');
  });

  it('[DOC-001] rejects unknown and missing requirement IDs on the Spec line', () => {
    const unknown = GOOD_HEADER.replace('TST-001', 'TST-999');
    const empty = GOOD_HEADER.replace('TST-001', 'see the spec');
    const root = makeRepo({ 'tools/a/a.mjs': unknown, 'tools/b/b.mjs': empty });
    expect(problems(root, 'module-header')).toEqual([
      'tools/a/a.mjs:1 "Spec:" names unknown requirement TST-999',
      'tools/b/b.mjs:1 "Spec:" line names no requirement ID',
    ]);
  });

  it('[DOC-001] reads shell headers written as # comments after the shebang', () => {
    const script =
      '#!/usr/bin/env bash\n# fetch — downloads a thing.\n#\n# Why: we need the thing.\n# Spec: TST-002\n# Tests: manual\nset -e\n';
    expect(headerLines(script)).toContain('Spec: TST-002');
    const root = makeRepo({ 'tools/fetch/fetch.sh': script });
    expect(problems(root, 'module-header')).toEqual([]);
  });

  it('[DOC-001] asks test files only for a summary and a Spec line', () => {
    const header = '/**\n * Tests for w.\n *\n * Spec: TST-001\n */\n';
    const root = makeRepo({ 'tools/w/test/w.test.mjs': header + testCall('it', '[TST-001] x') });
    expect(problems(root, 'module-header')).toEqual([]);
  });

  it('[DOC-001] skips test fixtures, vendored code and fetched H5P files', () => {
    const root = makeRepo({
      'tools/w/test/fixtures/broken.mjs': 'no header',
      'tools/w/vendor/lib.js': 'no header',
      'apps/server/h5p/core/js/h5p.js': 'no header',
    });
    expect(problems(root, 'module-header')).toEqual([]);
  });

  it('[DOC-001] passes on this repository', () => {
    const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
    expect(lint(repoRoot).map((p) => `${p.file}:${p.line} [${p.check}] ${p.message}`)).toEqual([]);
  });
});

describe('[DOC-002] TSDoc on exports', () => {
  it('[DOC-002] accepts exports that are directly preceded by a doc comment', () => {
    const ts = `${GOOD_HEADER}/** Adds one. */\nexport function inc(n: number) { return n + 1; }\n`;
    const root = makeRepo({ 'apps/server/src/inc.ts': ts });
    expect(problems(root, 'export-docs')).toEqual([]);
  });

  it('[DOC-002] flags an undocumented export with its kind and name', () => {
    const ts = `${GOOD_HEADER}export interface Widget { id: string }\n`;
    const root = makeRepo({ 'apps/server/src/widget.ts': ts });
    expect(problems(root, 'export-docs')).toEqual([
      'apps/server/src/widget.ts:8 exported interface "Widget" has no TSDoc comment',
    ]);
  });

  it('[DOC-002] looks past decorators to find the comment', () => {
    const ts = `${GOOD_HEADER}/** A service. */\n@injectable()\nexport class Service {}\n`;
    const root = makeRepo({ 'apps/server/src/service.ts': ts });
    expect(problems(root, 'export-docs')).toEqual([]);
  });

  it('[DOC-002] rejects @spec tags that name unknown requirements', () => {
    const ts = `${GOOD_HEADER}/**\n * Adds one.\n * @spec TST-404\n */\nexport const inc = (n: number) => n + 1;\n`;
    const root = makeRepo({ 'apps/server/src/inc.ts': ts });
    expect(problems(root, 'export-docs')).toEqual(['apps/server/src/inc.ts:10 @spec names unknown TST-404']);
  });

  it('[DOC-002] ignores JavaScript tooling and test files', () => {
    const root = makeRepo({
      'tools/w/w.mjs': `${GOOD_HEADER}export const a = 1;\n`,
      'apps/server/test/a.test.ts': `export const helper = 1;\n${testCall('it', '[TST-001] x')}`,
    });
    expect(problems(root, 'export-docs')).toEqual([]);
  });
});

describe('[DOC-003] rationale tags', () => {
  it('[DOC-003] accepts tags that explain themselves', () => {
    const code =
      GOOD_HEADER +
      comment('WHY', 'the Hub rejects ids longer than fifteen characters.') +
      comment('UPSTREAM', 'fixed in a later release, see https://github.com/x/y/issues/1') +
      comment('SPEC-DEVIATION', 'D-001 keeps the old behaviour until S2.');
    const root = makeRepo({ 'tools/w/w.mjs': code });
    expect(problems(root, 'rationale-tags')).toEqual([]);
  });

  it('[DOC-003] rejects empty or too short explanations', () => {
    const code = GOOD_HEADER + comment('SECURITY', 'see above') + comment('PRIVACY', '*/', '/*');
    const root = makeRepo({ 'tools/w/w.mjs': code });
    expect(problems(root, 'rationale-tags')).toEqual([
      'tools/w/w.mjs:8 SECURITY: explanation is missing or too short (at least 15 characters)',
      'tools/w/w.mjs:9 PRIVACY: explanation is missing or too short (at least 15 characters)',
    ]);
  });

  it('[DOC-003] requires a link for UPSTREAM and a decision for SPEC-DEVIATION', () => {
    const code =
      GOOD_HEADER +
      comment('UPSTREAM', 'the library still has this bug today.') +
      comment('SPEC-DEVIATION', 'we chose another approach here.', '#');
    const root = makeRepo({ 'tools/w/w.sh': code });
    expect(problems(root, 'rationale-tags')).toEqual([
      'tools/w/w.sh:8 UPSTREAM: must link to the upstream issue',
      'tools/w/w.sh:9 SPEC-DEVIATION: must name a decision (D-xxx)',
    ]);
  });
});
