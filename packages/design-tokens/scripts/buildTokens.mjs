/**
 * buildTokens — writes dist/tokens.css, dist/tailwind-theme.css and dist/h5p-daylight.css from tokens.json, or with
 * `--check` fails when the committed files differ from what it would write.
 *
 * Why: the generated files are committed so the server and the web app need no build step (D-072); `--check` in CI
 *      keeps them from drifting away from tokens.json. Plain Node with no dependencies, so it runs before
 *      `npm ci` has built anything.
 * Spec: UD-001
 * Invariants:
 *   - `--check` writes nothing and exits 1 naming each stale or missing file; 0 when all match.
 *   - `--out=<dir>` and `--tokens=<file>` point the script elsewhere (used by the tests); defaults are dist/ and
 *     tokens.json next to this folder.
 *   - A malformed tokens.json exits 1 with the reason, before any file is written.
 * Collaborators: ./tokenCss.mjs, ./tokenModel.mjs; root scripts `npm run tokens:build` and `npm run tokens:check`.
 * Tests: packages/design-tokens/test/buildTokens.test.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAll } from './tokenCss.mjs';
import { readTokens, TOKENS_FILE } from './tokenModel.mjs';

/** Where the generated files go by default. */
export const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));

/**
 * Compares the generated text with the files on disk.
 * @param {Record<string, string>} files - File name → expected text.
 * @param {string} outDir - Directory to compare against.
 * @returns {string[]} Names of files that are missing or differ.
 */
export function staleFiles(files, outDir) {
  return Object.entries(files)
    .filter(([name, text]) => {
      const path = join(outDir, name);
      return !existsSync(path) || readFileSync(path, 'utf8') !== text;
    })
    .map(([name]) => name);
}

/**
 * Runs the build or the check.
 * @param {string[]} args - Command-line arguments without `node` and the script path.
 * @returns {number} The exit code.
 */
export function main(args) {
  const option = (key) => args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const outDir = resolve(option('out') ?? DIST_DIR);
  let files;
  try {
    files = generateAll(readTokens(option('tokens') ?? TOKENS_FILE));
  } catch (error) {
    console.error(`✗ tokens.json: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (args.includes('--check')) {
    const stale = staleFiles(files, outDir);
    for (const name of stale) console.error(`✗ ${name} is out of date; run npm run tokens:build`);
    if (stale.length === 0) console.log(`✓ design tokens: ${Object.keys(files).length} files up to date.`);
    return stale.length === 0 ? 0 : 1;
  }
  mkdirSync(outDir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(outDir, name), text);
  console.log(`✓ design tokens: wrote ${Object.keys(files).join(', ')} to ${outDir}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
