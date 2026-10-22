/**
 * checkInventory — fails when the data inventory and the Prisma schema disagree, or when a learner
 * table gains a column that looks like personal data.
 *
 * Why: the inventory is what HVL's data protection officer reads (DATA-001, DATA-005). It is only
 *      trustworthy if every stored field appears in it, with a purpose, category, basis, retention and location.
 * Spec: DATA-001, DATA-002
 * Invariants:
 *   - Each model has a `## Model` section in docs/privacy/DATA-INVENTORY.md with one table row per field.
 *   - Rows name fields in backticks and have six filled cells; the inventory lists nothing the schema lacks.
 *   - Learner tables hold no column named like a name, e-mail, Feide ID, national ID or raw LTI subject,
 *     except `GradeSyncJob.ltiSubEncrypted` (DATA-002).
 * Collaborators: ./prismaSchema.mjs, docs/privacy/DATA-INVENTORY.md, CI (`npm run privacy:inventory-check`).
 * Tests: tools/privacy/test/checkInventory.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSchemaModels } from './prismaSchema.mjs';

/** Path of the inventory, relative to the repository root. */
export const INVENTORY = 'docs/privacy/DATA-INVENTORY.md';
/** Tables that hold learner data and therefore must stay free of direct identifiers (DATA-002). */
export const LEARNER_TABLES = ['H5PUserData', 'XapiStatement', 'GradeSyncJob', 'Identity'];
/** Words that mark a column storing a direct identifier, matched anywhere in the name, in any case. */
export const PII_WORDS = /(name|e-?mail|feide|personnummer|fodselsnummer|ltisub)/i;
/**
 * Short identifiers that must be a whole camelCase word: `sub`, and `nin` (national ID number) as in
 * `nin`, `ninHash` or `learnerNin`.
 */
// WHY: case-sensitive on purpose, so `learningPhase` or `runningScore` are not read as containing `nin`.
export const PII_TOKENS = /^sub$|^nin$|^nin[A-Z_]|[a-z]Nin$/;
const ALLOWED_PII = new Set(['GradeSyncJob.ltiSubEncrypted']);

/**
 * Parses the inventory into rows per model.
 * @param {string} markdown - Inventory text.
 * @returns {Map<string, Map<string, string[]>>} Cells (without the field cell) by field, by model.
 */
export function parseInventory(markdown) {
  const models = new Map();
  let current;
  for (const line of markdown.split('\n')) {
    const heading = /^## `?(\w+)`?\s*$/.exec(line);
    if (heading) models.set(heading[1], (current = new Map()));
    const row = /^\|\s*`(\w+)`\s*\|(.*)\|\s*$/.exec(line);
    if (row && current)
      current.set(
        row[1],
        row[2].split('|').map((c) => c.trim()),
      );
  }
  return models;
}

/**
 * Compares schema and inventory.
 * @param {Map<string, {name: string}[]>} schema - From `readSchemaModels`.
 * @param {Map<string, Map<string, string[]>>} inventory - From `parseInventory`.
 * @returns {string[]} Problems; empty when they match.
 */
export function compareInventory(schema, inventory) {
  const problems = [];
  for (const [model, fields] of schema) {
    const rows = inventory.get(model);
    if (!rows) {
      problems.push(`model ${model} has no "## ${model}" section in ${INVENTORY}`);
      continue;
    }
    for (const f of fields) {
      const cells = rows.get(f.name);
      if (!cells) problems.push(`${model}.${f.name} is not in the inventory`);
      else if (cells.length !== 5 || cells.some((c) => c === '')) {
        problems.push(`${model}.${f.name} needs purpose, category, legal basis, retention and location`);
      }
    }
    for (const name of rows.keys()) {
      if (!fields.some((f) => f.name === name))
        problems.push(`${model}.${name} is in the inventory but not in the schema`);
    }
  }
  for (const model of inventory.keys()) {
    if (!schema.has(model)) problems.push(`section ${model} in the inventory has no model in the schema`);
  }
  return problems;
}

/**
 * Finds learner-table columns that look like direct identifiers.
 * @param {Map<string, {name: string}[]>} schema - From `readSchemaModels`.
 * @returns {string[]} One message per offending column.
 */
export function learnerTablePii(schema) {
  return LEARNER_TABLES.flatMap((model) =>
    (schema.get(model) ?? [])
      .filter(
        (f) => (PII_WORDS.test(f.name) || PII_TOKENS.test(f.name)) && !ALLOWED_PII.has(`${model}.${f.name}`),
      )
      .map(
        (f) => `${model}.${f.name} looks like personal data; learner tables store pseudonyms only (DATA-002)`,
      ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const schema = readSchemaModels(root);
  const inventory = parseInventory(readFileSync(join(root, INVENTORY), 'utf8'));
  const problems = [...compareInventory(schema, inventory), ...learnerTablePii(schema)];
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  const fields = [...schema.values()].reduce((n, f) => n + f.length, 0);
  console.log(`✓ privacy:inventory-check: ${schema.size} models, ${fields} fields, all in ${INVENTORY}.`);
}
