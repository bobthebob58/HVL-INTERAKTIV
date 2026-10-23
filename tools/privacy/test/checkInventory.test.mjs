/**
 * Tests for the data-inventory check and the learner-table rule.
 *
 * Spec: DATA-001, DATA-002
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareInventory,
  hasPiiToken,
  learnerTablePii,
  parseInventory,
  wordsOf,
  INVENTORY,
} from '../checkInventory.mjs';
import { parseModels, readSchemaModels } from '../prismaSchema.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCHEMA = `
model Note {
  id     String @id
  // a comment
  text   String?
  owner  User   @relation(fields: [ownerId], references: [id])
  ownerId String
  @@index([ownerId])
}
model User {
  id    String @id
  notes Note[]
}
`;
const row = (field) => `| \`${field}\` | Purpose | None | n/a | Account | PG |`;
const HEADER =
  '| Field | Purpose | Category | Legal basis | Retention | Location |\n|---|---|---|---|---|---|';

describe('[DATA-001] data inventory matches the schema', () => {
  it('[DATA-001] reads stored fields and skips relations, comments and block attributes', () => {
    const models = parseModels(SCHEMA);
    expect(models.get('Note')).toEqual([
      { name: 'id', type: 'String', optional: false },
      { name: 'text', type: 'String', optional: true },
      { name: 'ownerId', type: 'String', optional: false },
    ]);
    expect(models.get('User')?.map((f) => f.name)).toEqual(['id']);
  });

  it('[DATA-001] accepts an inventory with one complete row per field', () => {
    const md = `## Note\n\n${HEADER}\n${['id', 'text', 'ownerId'].map(row).join('\n')}\n\n## User\n\n${HEADER}\n${row('id')}\n`;
    expect(compareInventory(parseModels(SCHEMA), parseInventory(md))).toEqual([]);
  });

  it('[DATA-001] reports missing sections, missing fields, empty cells and stale entries', () => {
    // Arrange: an inventory with one problem of each kind
    const md = [
      `## Note`,
      HEADER,
      row('id'),
      '| `text` | Purpose | None |  | Account | PG |',
      row('legacy'),
      '## Ghost',
      HEADER,
    ].join('\n');
    // Act and assert
    expect(compareInventory(parseModels(SCHEMA), parseInventory(md))).toEqual([
      'Note.text needs purpose, category, legal basis, retention and location',
      'Note.ownerId is not in the inventory',
      'Note.legacy is in the inventory but not in the schema',
      'model User has no "## User" section in docs/privacy/DATA-INVENTORY.md',
      'section Ghost in the inventory has no model in the schema',
    ]);
  });

  it('[DATA-001] passes on this repository', () => {
    const inventory = parseInventory(readFileSync(join(ROOT, INVENTORY), 'utf8'));
    expect(compareInventory(readSchemaModels(ROOT), inventory)).toEqual([]);
  });
});

describe('[DATA-002] learner tables hold pseudonyms only', () => {
  it('[DATA-002] flags identifier-like columns on learner tables', () => {
    const schema = parseModels(
      'model XapiStatement {\n  learnerKey String\n  learnerEmail String\n  feideId String\n  sub String\n}',
    );
    expect(learnerTablePii(schema)).toEqual([
      'XapiStatement.learnerEmail looks like personal data; learner tables store pseudonyms only (DATA-002)',
      'XapiStatement.feideId looks like personal data; learner tables store pseudonyms only (DATA-002)',
      'XapiStatement.sub looks like personal data; learner tables store pseudonyms only (DATA-002)',
    ]);
  });

  it('[DATA-002] does not mistake ordinary words that contain "nin" for a national ID number', () => {
    const schema = parseModels(
      'model XapiStatement {\n  learningPhase String\n  runningScore Int\n  ninHash String\n  learnerNin String\n}',
    );
    expect(learnerTablePii(schema).map((p) => p.split(' ')[0])).toEqual([
      'XapiStatement.ninHash',
      'XapiStatement.learnerNin',
    ]);
  });

  it('[DATA-002] finds "nin" as a word anywhere in the name, in any case', () => {
    // Arrange: column names with "nin" as a word, in different positions and cases
    const names = [
      'NIN',
      'Nin',
      'learnerNinHash',
      'encryptedNinValue',
      'studentNIN',
      'learner_nin',
      'NIN_hash',
    ];
    const schema = parseModels(`model Identity {\n${names.map((n) => `  ${n} String`).join('\n')}\n}`);
    // Act and assert
    expect(learnerTablePii(schema).map((p) => p.split(' ')[0])).toEqual(names.map((n) => `Identity.${n}`));
    expect(wordsOf('learnerNinHash')).toEqual(['learner', 'Nin', 'Hash']);
    expect(wordsOf('studentNIN')).toEqual(['student', 'NIN']);
    expect(hasPiiToken('subContentId')).toBe(false);
  });

  it('[DATA-002] the real schema has no such column except the encrypted AGS subject', () => {
    // Arrange: the real Prisma schema
    const schema = readSchemaModels(ROOT);
    // Act and assert: no learner-table column is flagged
    expect(learnerTablePii(schema)).toEqual([]);
    // Assert: the AGS subject is stored encrypted, and a User's display name and e-mail are optional
    expect(schema.get('GradeSyncJob')?.find((f) => f.name === 'ltiSubEncrypted')).toMatchObject({
      type: 'Bytes',
      optional: true,
    });
    expect(
      schema
        .get('User')
        ?.filter((f) => ['displayName', 'email'].includes(f.name))
        .every((f) => f.optional),
    ).toBe(true);
  });
});
