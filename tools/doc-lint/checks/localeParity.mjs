/**
 * localeParity — Nynorsk, Bokmål and English locale files define exactly the same message keys.
 *
 * Why: user-facing text lives only in locale files (DOC-009). A key missing in one language would
 *      show a raw key or fall back silently, so every locale folder is checked as a whole.
 * Spec: DOC-009
 * Invariants:
 *   - Every folder named `locales` under apps/ and packages/ contains nn.json, nb.json and en.json.
 *   - Nested keys are compared as dotted paths; `nn` is the reference locale (Nynorsk first).
 * Collaborators: ../lib/repo.mjs, apps/server/src/i18n (runtime lookup).
 * Tests: tools/doc-lint/test/docLint.repo.test.mjs
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { listFiles, read } from '../lib/repo.mjs';

export const id = 'DOC-009';
export const name = 'locale-parity';
/** Required locales, reference first. */
export const LOCALES = ['nn', 'nb', 'en'];

/**
 * Flattens a nested message object into dotted keys.
 * @param {object} obj - Parsed locale JSON.
 * @param {string} [prefix] - Key prefix for recursion.
 * @returns {string[]} Sorted dotted keys.
 */
export function flattenKeys(obj, prefix = '') {
  return Object.entries(obj)
    .flatMap(([k, v]) => (v && typeof v === 'object' ? flattenKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
    .sort();
}

/**
 * Compares the key sets of each locale folder.
 * @param {{root: string}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root }) {
  const problems = [];
  const folders = new Set(
    ['apps', 'packages']
      .flatMap((d) => listFiles(root, d))
      .filter((f) => /\/locales\/[^/]+\.json$/.test(f))
      .map(dirname),
  );
  for (const folder of folders) {
    const keys = {};
    for (const loc of LOCALES) {
      const file = `${folder}/${loc}.json`;
      if (!existsSync(join(root, file))) {
        problems.push({ file, line: 1, message: `missing ${loc} locale file` });
        continue;
      }
      keys[loc] = new Set(flattenKeys(JSON.parse(read(root, file))));
    }
    if (!keys.nn) continue;
    for (const loc of LOCALES.slice(1).filter((l) => keys[l])) {
      for (const k of keys.nn)
        if (!keys[loc].has(k))
          problems.push({ file: `${folder}/${loc}.json`, line: 1, message: `missing key ${k}` });
      for (const k of keys[loc])
        if (!keys.nn.has(k))
          problems.push({
            file: `${folder}/${loc}.json`,
            line: 1,
            message: `extra key ${k} (not in nn.json)`,
          });
    }
  }
  return problems;
}
