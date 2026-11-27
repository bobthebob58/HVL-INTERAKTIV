/**
 * buildSiteIcon — writes the web app's browser-tab icon (icon.svg and favicon.ico) from tokens.json, or with
 * `--check` fails when the committed files differ from what it would write.
 *
 * Why: the icon's colours are tokens (UD-001), so it is generated like the token CSS and held by the same
 *      check in CI. The files live in the web app's `app` folder because Next.js serves an icon from there and
 *      links it from every page; `/favicon.ico` is also what a browser asks for on a page that names no icon.
 * Spec: UD-001
 * Invariants:
 *   - `--check` writes nothing and exits 1 naming each stale or missing file; 0 when both match, byte for byte.
 *   - `--out=<dir>` and `--tokens=<file>` point the script elsewhere (used by the tests).
 *   - A tokens file without the icon's colours exits 1 with the reason, before any file is written.
 * Collaborators: ./siteIcon.mjs, ./tokenModel.mjs; root scripts `npm run tokens:build` and `npm run tokens:check`.
 * Tests: packages/design-tokens/test/siteIcon.test.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconFiles } from './siteIcon.mjs';
import { readTokens, TOKENS_FILE } from './tokenModel.mjs';

/** Where the icon files go by default: the web app's `app` folder. */
export const ICON_DIR = fileURLToPath(new URL('../../../apps/web/src/app/', import.meta.url));

/**
 * Runs the build or the check.
 * @param {string[]} args - Command-line arguments without `node` and the script path.
 * @returns {number} The exit code.
 */
export function main(args) {
  const option = (key) => args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const outDir = resolve(option('out') ?? ICON_DIR);
  let files;
  try {
    files = iconFiles(readTokens(option('tokens') ?? TOKENS_FILE));
  } catch (error) {
    console.error(`✗ tokens.json: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const names = Object.keys(files);
  if (args.includes('--check')) {
    const stale = names.filter((name) => {
      const path = join(outDir, name);
      return !existsSync(path) || !readFileSync(path).equals(files[name]);
    });
    for (const name of stale) console.error(`✗ ${name} is out of date; run npm run tokens:build`);
    if (stale.length === 0) console.log(`✓ site icon: ${names.length} files up to date.`);
    return stale.length === 0 ? 0 : 1;
  }
  mkdirSync(outDir, { recursive: true });
  for (const name of names) writeFileSync(join(outDir, name), files[name]);
  console.log(`✓ site icon: wrote ${names.join(', ')} to ${outDir}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
