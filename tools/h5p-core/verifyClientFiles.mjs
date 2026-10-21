/**
 * verifyClientFiles — checks fetched H5P client files against a committed per-file SHA-256 list.
 *
 * Why: the server ships H5P's JavaScript to every learner. We fetch it instead of committing it (D-027),
 *      so each file must be proven identical to the reviewed release before it is used (H5P-001, D-022).
 * Spec: H5P-001
 * Invariants:
 *   - Hash lists use `sha256sum` format (`<hex>  <path>`); a leading folder prefix can be stripped.
 *   - `verify` fails on a missing file, a changed file, and (always) on a file the list does not name.
 *   - `record` is only for a new pinned editor commit; its output is reviewed and committed (D-022).
 * Collaborators: ./fetchCoreClients.sh, docs/reference/h5p-core-1.28-seed-packages/*.files.sha256.
 * Tests: tools/h5p-core/test/verifyClientFiles.test.mjs
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Parses a `sha256sum` list.
 * @param {string} text - List contents.
 * @param {string} [prefix] - Folder prefix to strip from each path, e.g. "h5p-php-library-1.28.0/".
 * @returns {Map<string, string>} Hash by relative path.
 */
export function readHashList(text, prefix = '') {
  const hashes = new Map();
  for (const line of text.split('\n').filter((l) => l.trim() !== '')) {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (!m) throw new Error(`not a sha256sum line: ${line}`);
    hashes.set(m[2].startsWith(prefix) ? m[2].slice(prefix.length) : m[2], m[1]);
  }
  return hashes;
}

/**
 * Hashes every file under a directory.
 * @param {string} dir - Absolute directory.
 * @returns {Map<string, string>} Hash by path relative to `dir`, sorted.
 */
export function hashTree(dir) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split('\\').join('/'))
    .sort();
  return new Map(
    files.map((f) => [
      f,
      createHash('sha256')
        .update(readFileSync(join(dir, f)))
        .digest('hex'),
    ]),
  );
}

/**
 * Compares a directory with an expected hash list.
 * @param {Map<string, string>} actual - From `hashTree`.
 * @param {Map<string, string>} expected - From `readHashList`.
 * @returns {string[]} Problems; empty when the trees are identical.
 */
export function compareTrees(actual, expected) {
  const problems = [];
  for (const [file, hash] of expected) {
    if (!actual.has(file)) problems.push(`missing: ${file}`);
    else if (actual.get(file) !== hash) problems.push(`changed: ${file}`);
  }
  for (const file of actual.keys()) if (!expected.has(file)) problems.push(`unexpected: ${file}`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, dir, listFile] = process.argv.slice(2);
  const prefix = process.argv.find((a) => a.startsWith('--prefix='))?.slice('--prefix='.length) ?? '';
  if (mode === 'record') {
    const lines = [...hashTree(dir)].map(([file, hash]) => `${hash}  ${prefix}${file}`);
    writeFileSync(listFile, `${lines.join('\n')}\n`);
    console.log(`Recorded ${lines.length} hashes in ${listFile}. Review and commit it (D-022).`);
  } else if (mode === 'verify') {
    const problems = compareTrees(hashTree(dir), readHashList(readFileSync(listFile, 'utf8'), prefix));
    for (const p of problems) console.error(`✗ ${p}`);
    if (problems.length > 0) process.exit(1);
    console.log(`✓ ${dir}: every file matches ${listFile}.`);
  } else {
    console.error('usage: verifyClientFiles.mjs verify|record <dir> <hash-list> [--prefix=<folder>/]');
    process.exit(2);
  }
}
