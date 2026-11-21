/**
 * Proves the lint rule for slow patterns (eslint.config.mjs, D-127): a pattern whose cost grows faster than the
 * text it reads is an error in the code that runs in the service and in the browser, the forms that code uses
 * instead are accepted, and tests are not covered.
 *
 * Spec: NFR-004, NFR-002
 */
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SLOW_RULES = ['regexp/no-super-linear-move', 'regexp/no-super-linear-backtracking'];

describe('[NFR-004] the lint rule for slow patterns', () => {
  let eslint: ESLint;
  /** The slow-pattern rules a piece of code breaks, as if it were the file at `path`. */
  const slowRulesBroken = async (code: string, path: string): Promise<string[]> => {
    const [result] = await eslint.lintText(code, { filePath: `${ROOT}${path}` });
    return (result?.messages ?? [])
      .map((message) => message.ruleId ?? '')
      .filter((id) => SLOW_RULES.includes(id));
  };
  beforeAll(() => {
    eslint = new ESLint({ cwd: ROOT });
  });

  it.each([
    [
      'a run at the end found from every start',
      "export const a = (t: string) => t.replace(/\\s+$/, '');",
      SLOW_RULES[0],
    ],
    [
      'a run before a quote found from every start',
      "export const b = (t: string) => t.replace(/\\\\+(['\"])/g, '$1');",
      SLOW_RULES[0],
    ],
    [
      'two parts that can share characters',
      "export const c = (t: string) => t.replace(/ at \\d+.*$/, '');",
      SLOW_RULES[1],
    ],
  ])(
    '[NFR-004] refuses %s, in the server, the web app and a package',
    async (_label, code, rule) => {
      // Act
      const broken = await Promise.all(
        ['apps/server/src/fixture.ts', 'apps/web/src/fixture.ts', 'packages/api-contract/src/fixture.ts'].map(
          (path) => slowRulesBroken(code, path),
        ),
      );
      // Assert
      expect(broken).toEqual([[rule], [rule], [rule]]);
    },
    60_000,
  );

  it('[NFR-004] accepts the forms the code uses instead', async () => {
    // Arrange: trimming without a pattern, a run that may begin only where it begins, one part instead of two
    const code = [
      'export const a = (t: string) => t.trimEnd();',
      "export const b = (t: string) => t.replace(/(?<!\\\\)\\\\+(['\"])/g, '$1');",
      "export const c = (t: string) => t.replace(/ at \\d.*$/, '');",
      'export const d = (t: string) => /[^\\n\\r\\u2028\\u2029] \\d+\\.\\d/.test(t);',
    ].join('\n');
    // Act
    const broken = await slowRulesBroken(code, 'apps/server/src/fixture.ts');
    // Assert
    expect(broken).toEqual([]);
  }, 60_000);

  it('[NFR-004] does not cover test files, whose patterns read text the tests wrote', async () => {
    // Act
    const broken = await slowRulesBroken(
      "export const a = (t: string) => t.replace(/\\s+$/, '');",
      'apps/server/test/fixture.test.ts',
    );
    // Assert
    expect(broken).toEqual([]);
  }, 60_000);
});
