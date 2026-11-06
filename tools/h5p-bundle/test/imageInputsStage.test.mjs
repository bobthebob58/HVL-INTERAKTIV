/**
 * Tests that the image build's `inputs` stage copies every file the checks it runs need: each script its `RUN` line
 * starts with `node`, and every file those scripts import by a relative path, the shared build-secret rules in
 * apps/server among them (D-110 amendment of 2026-11-06). Without one, `bundleCli.mjs verify` fails in the image
 * build alone, and no other test runs that stage.
 *
 * Spec: NFR-007
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DOCKERFILE = readFileSync(join(ROOT, 'deploy/Dockerfile'), 'utf8');
const RULES_COPY = 'COPY apps/server/src/h5p/libraries/libraryBuildSecrets.ts apps/server/src/h5p/libraries/';
const RELATIVE_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)['"](\.{1,2}\/[^'"]+)['"]/gm;

/** The instructions of one stage, continuation lines joined, from its `FROM … AS <name>` to the next `FROM`. */
function stageInstructions(dockerfile, name) {
  const lines = dockerfile.replace(/\\\n/g, ' ').split('\n');
  const start = lines.findIndex((line) => new RegExp(`^FROM\\s+\\S+\\s+AS\\s+${name}\\s*$`, 'i').test(line));
  const end = lines.findIndex((line, i) => i > start && /^FROM\s/i.test(line));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .filter((line) => line.trim() && !/^\s*#/.test(line));
}

/** The repository files a script needs, itself and its relative imports, transitively. */
function filesNeeded(script, seen = new Set()) {
  if (seen.has(script)) return seen;
  seen.add(script);
  for (const [, specifier] of readFileSync(join(ROOT, script), 'utf8').matchAll(RELATIVE_IMPORT))
    filesNeeded(posix.normalize(posix.join(posix.dirname(script), specifier)), seen);
  return seen;
}

/** The files the stage's `node` commands need that no `COPY` (from the build context) puts at the same path. */
function filesNotCopied(dockerfile) {
  const instructions = stageInstructions(dockerfile, 'inputs');
  const copied = instructions
    .filter((line) => /^COPY\s/i.test(line) && !/--from=/.test(line))
    .flatMap((line) => {
      const words = line.trim().split(/\s+/).slice(1);
      const target = words.at(-1) ?? '';
      return words.slice(0, -1).map((source) => ({ source, target }));
    });
  const isCopied = (file) =>
    copied.some(({ source, target }) => {
      const pattern = new RegExp(`^${source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
      return pattern.test(file) && posix.normalize(`${posix.dirname(file)}/`) === posix.normalize(target);
    });
  const scripts = instructions
    .filter((line) => /^RUN\s/i.test(line))
    .flatMap((line) => [...line.matchAll(/\bnode\s+(tools\/\S+\.m?js)\b/g)].map((match) => match[1]));
  return [...new Set(scripts.flatMap((script) => [...filesNeeded(script)]))]
    .filter((file) => !isCopied(file))
    .sort();
}

describe('[NFR-007] the image build has every file its bundle check needs', () => {
  it('[NFR-007] the inputs stage copies each script it runs and each file they import, the shared rules too', () => {
    expect(filesNotCopied(DOCKERFILE), `add to deploy/Dockerfile, stage inputs: ${RULES_COPY}`).toEqual([]);
  });

  it('[NFR-007] the check follows the imports into apps/server and names a file the stage leaves out', () => {
    // Arrange: the stage without the rules file and without the manifest resolver, then with every file.
    const withRules = DOCKERFILE.includes(RULES_COPY)
      ? DOCKERFILE
      : DOCKERFILE.replace(/^(COPY tools\/h5p-bundle\/.*)$/m, `$1\n${RULES_COPY}`);
    const withoutBoth = withRules
      .replace(`${RULES_COPY}\n`, '')
      .replace(/^COPY tools\/h5p-libraries\/resolveManifest\.mjs .*\n/m, '');
    // Act and assert
    expect(filesNeeded('tools/h5p-bundle/bundleCli.mjs')).toContain(
      'apps/server/src/h5p/libraries/libraryBuildSecrets.ts',
    );
    expect(filesNotCopied(withoutBoth)).toEqual([
      'apps/server/src/h5p/libraries/libraryBuildSecrets.ts',
      'tools/h5p-libraries/resolveManifest.mjs',
    ]);
    expect(filesNotCopied(withRules)).toEqual([]);
    expect(existsSync(join(ROOT, dirname('apps/server/src/h5p/libraries/libraryBuildSecrets.ts')))).toBe(
      true,
    );
  });
});
