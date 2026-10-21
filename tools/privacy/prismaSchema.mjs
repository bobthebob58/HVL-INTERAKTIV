/**
 * prismaSchema — reads models and their stored fields from the Prisma schema files.
 *
 * Why: the data inventory (DATA-001) and the learner-table rule (DATA-002) must be checked against the
 *      real schema, not a hand-kept copy. A small parser keeps these checks free of Prisma internals.
 * Spec: DATA-001, DATA-002
 * Invariants:
 *   - Only stored columns count: relation fields (whose type is another model) are skipped.
 *   - Comment lines and block attributes (`@@index`, `@@unique`, …) are ignored.
 * Collaborators: ./checkInventory.mjs, apps/server/prisma/schema/*.prisma.
 * Tests: tools/privacy/test/checkInventory.test.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Folder of the split Prisma schema, relative to the repository root. */
export const SCHEMA_DIR = 'apps/server/prisma/schema';

/**
 * Parses Prisma schema text into models and their stored fields.
 * @param {string} text - Concatenated contents of all .prisma files.
 * @returns {Map<string, {name: string, type: string, optional: boolean}[]>} Fields by model name.
 */
export function parseModels(text) {
  const blocks = [...text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const modelNames = new Set(blocks.map((b) => b[1]));
  const models = new Map();
  for (const [, name, body] of blocks) {
    const fields = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('//') && !line.startsWith('@@'))
      .map((line) => /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(line))
      .filter((m) => m && !modelNames.has(m[2]))
      .map((m) => ({ name: m[1], type: m[2], optional: m[4] === '?' }));
    models.set(name, fields);
  }
  return models;
}

/**
 * Reads every .prisma file of the schema folder.
 * @param {string} root - Absolute repository root.
 * @returns {Map<string, {name: string, type: string, optional: boolean}[]>} Fields by model name.
 */
export function readSchemaModels(root) {
  const dir = join(root, SCHEMA_DIR);
  const text = readdirSync(dir)
    .filter((f) => f.endsWith('.prisma'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  return parseModels(text);
}
