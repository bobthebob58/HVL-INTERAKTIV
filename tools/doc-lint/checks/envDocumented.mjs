/**
 * envDocumented — every environment variable an app reads is documented in its `.env.example`.
 *
 * Why: configuration must be documented where it is defined, so operators never have to read code
 *      to learn what a variable does or whether it is secret.
 * Spec: DOC-008
 * Invariants:
 *   - Variable names come from the zod schema in `apps/<app>/src/config/env.ts` (keys in UPPER_CASE).
 *   - Each variable in `.env.example` is preceded by a comment block that states its purpose and
 *     contains `Secret:` and `Default:` (the example value is the assignment itself).
 *   - `.env.example` lists no variable the schema does not know.
 * Collaborators: ../lib/repo.mjs, apps/server/src/config/env.ts.
 * Tests: tools/doc-lint/test/docLint.repo.test.mjs
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { read } from '../lib/repo.mjs';

export const id = 'DOC-008';
export const name = 'env-documented';

/**
 * Checks each app's environment schema against its `.env.example`.
 * @param {{root: string}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root }) {
  const problems = [];
  const apps = existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')) : [];
  for (const app of apps) {
    const schemaFile = `apps/${app}/src/config/env.ts`;
    if (!existsSync(join(root, schemaFile))) continue;
    const declared = new Set(
      [...read(root, schemaFile).matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*z\b/gm)].map((m) => m[1]),
    );
    const exampleFile = `apps/${app}/.env.example`;
    if (!existsSync(join(root, exampleFile))) {
      problems.push({
        file: exampleFile,
        line: 1,
        message: 'missing; it must document every variable in env.ts',
      });
      continue;
    }
    const lines = read(root, exampleFile).split('\n');
    const documented = new Set();
    lines.forEach((line, i) => {
      const m = /^([A-Z][A-Z0-9_]+)=/.exec(line);
      if (!m) return;
      documented.add(m[1]);
      const say = (message) =>
        problems.push({ file: exampleFile, line: i + 1, message: `${m[1]} ${message}` });
      let start = i;
      while (start > 0 && lines[start - 1].startsWith('#')) start--;
      const comment = lines.slice(start, i).join('\n');
      if (comment === '') say('has no explanatory comment above it');
      else
        for (const label of ['Secret:', 'Default:'])
          if (!comment.includes(label)) say(`comment lacks "${label}"`);
      if (!declared.has(m[1])) say('is not in env.ts');
    });
    for (const v of [...declared].filter((d) => !documented.has(d))) {
      problems.push({ file: exampleFile, line: 1, message: `${v} (from env.ts) is not documented here` });
    }
  }
  return problems;
}
