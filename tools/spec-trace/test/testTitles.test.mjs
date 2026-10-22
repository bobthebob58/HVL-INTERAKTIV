/**
 * Tests for reading test titles: which calls count, and which are commented out, quoted or skipped.
 *
 * Spec: DOC-004, DOC-006
 */
import { describe, it, expect } from 'vitest';
import { testCall } from '../../doc-lint/test/tempRepo.mjs';
import { blankLiterals, leadingIds, testTitles } from '../testTitles.mjs';

/** Titles of the running it()/test() calls in `source`. */
const running = (source) =>
  testTitles(source)
    .filter((t) => t.active && t.fn !== 'describe')
    .map((t) => t.title);

describe('[DOC-004] which test titles count', () => {
  it('[DOC-004] reads it, test, modifiers, two-call forms and template titles', () => {
    const source =
      testCall('it', '[TST-001] plain') +
      testCall('test.concurrent', '[TST-001] concurrent') +
      testCall('it.each([1, 2])', '[TST-001] each %i') +
      testCall('test.runIf(true)', '[TST-001] runIf') +
      'it(`[TST-001] template ${name}`, () => {});\n';
    expect(running(source)).toEqual([
      '[TST-001] plain',
      '[TST-001] concurrent',
      '[TST-001] each %i',
      '[TST-001] runIf',
      '[TST-001] template ${name}',
    ]);
  });

  it('[DOC-004] ignores calls in comments, strings and regex literals, and method calls', () => {
    const source =
      `// ${testCall('it', '[TST-002] line comment')}` +
      `/* ${testCall('it', '[TST-002] block comment')} */\n` +
      `const s = "${testCall('it', '[TST-002] in a string').trim()}";\n` +
      "const r = /it\\('[TST-002]/g; const ratio = a / b / c;\n" +
      testCall('runner.it', '[TST-002] method') +
      testCall('it', '[TST-001] real');
    expect(running(source)).toEqual(['[TST-001] real']);
  });

  it('[DOC-004] treats skipped, todo, failing and x-prefixed tests as not running', () => {
    const source =
      testCall('it.skip', '[TST-002] skip') +
      testCall('it.concurrent.skip', '[TST-002] concurrent skip') +
      testCall('test.todo', '[TST-002] todo') +
      testCall('it.fails', '[TST-002] fails') +
      testCall('it.skipIf(true)', '[TST-002] skipIf') +
      testCall('xit', '[TST-002] xit');
    expect(running(source)).toEqual([]);
  });

  it('[DOC-004] treats every test inside a skipped describe as not running', () => {
    const inner = testCall('it', '[TST-002] inner');
    const source =
      `describe.skip('[TST-002] group', () => {\n  ${inner}  describe('nested', () => { ${inner} });\n});\n` +
      `describe.todo('[TST-002] later', () => { ${inner} });\n` +
      `describe.skipIf(ci)('[TST-002] local', () => { ${inner} });\n` +
      `xdescribe('[TST-002] x', () => { ${inner} });\n` +
      `describe('[TST-001] runs', () => { ${testCall('it', '[TST-001] inner')} });\n`;
    expect(running(source)).toEqual(['[TST-001] inner']);
  });

  it('[DOC-004] keeps offsets when blanking, and reads only the opening ID group', () => {
    const source = "it('a(b', () => {}); // (\n/* ) */ const x = `${'('}`;\n";
    expect(blankLiterals(source).code).toHaveLength(source.length);
    expect(leadingIds('[SEC-001][SEC-002] strips scripts, see [SEC-003]')).toEqual(['SEC-001', 'SEC-002']);
    expect(leadingIds('strips scripts [SEC-001]')).toEqual([]);
  });
});
