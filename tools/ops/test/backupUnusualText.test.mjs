/**
 * backupUnusualText.test — a backup and restore of rows and file names that hold characters a line reader or a
 * field separator could take for an end (D-132): U+2028, U+2029 and U+0085 in texts and JSON, a bar and a line
 * break in a content file's key. The counts the backup records are the real ones, and the restore finds nothing
 * differing or missing.
 * Spec: NFR-002
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { missingContentFiles, psqlRows } from '../postgresDump.mjs';
import {
  createBucket,
  createDatabase,
  databaseUrl,
  dropDatabase,
  listKeys,
  pgEnv,
  putObject,
  removeBucket,
  runCli,
  runName,
  s3Client,
  serviceEnv,
  servicesConfigured,
  tableCounts,
} from './backupBench.mjs';

const describeWithServices = servicesConfigured ? describe : describe.skip;
/** The line separator, the paragraph separator and "next line": none of them ends a row of a dump. */
const SEPARATORS = '  \u0085';

describeWithServices('a backup of unusual text (NFR-002)', () => {
  const database = runName('hvli_text').replaceAll('-', '_');
  const bucket = runName('test-text');
  const contentId = randomUUID();
  const owner = randomUUID();
  /** A key with a bar, and one with the separators, as an imported file's name may be. */
  const keys = [`content/${contentId}/del 1 | del 2.txt`, `content/${contentId}/ark${SEPARATORS}.txt`];
  /** A key with a line break: the storage emulator takes none, so this row is checked against the database alone. */
  const brokenLine = `content/${contentId}/linje 1\nlinje 2 | kopi.txt`;
  const s3 = s3Client();
  const env = { ...serviceEnv(), DATABASE_URL: databaseUrl(database), S3_CONTENT_BUCKET: bucket };
  const sql = (statement) => psqlRows(pgEnv(database), statement);
  let out;
  let before;
  let backupDir;

  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'hvli-backup-text-'));
    await createDatabase(database, { migrate: true });
    const text = `Første linje${SEPARATORS}andre linje`;
    const files = keys
      .map((key, index) => `(gen_random_uuid(), '${contentId}', 'fil-${index}.txt', '${key}', 5, 'x')`)
      .join(', ');
    for (const statement of [
      `INSERT INTO "User" (id, kind) VALUES ('${owner}', 'staff')`,
      `INSERT INTO "H5PContent" (id, "mainLibrary", title, params, metadata, "ownerUserId", "updatedAt") VALUES ` +
        `('${contentId}', 'H5P.MultiChoice 1.16', '${text}', '${JSON.stringify({ question: text })}', ` +
        `'{"title":"Kopi"}', '${owner}', now())`,
      `INSERT INTO "H5PUserData" (id, "contentId", "dataType", "learnerKey", data, "updatedAt") ` +
        `SELECT gen_random_uuid(), '${contentId}', 'state', 'key-' || g, '${JSON.stringify({ answer: text })}', ` +
        'now() FROM generate_series(1, 30) AS g',
      `INSERT INTO "H5PContentFile" (id, "contentId", filename, "s3Key", size, sha256) VALUES ${files}`,
    ])
      await sql(statement);
    await createBucket(s3, bucket);
    for (const key of keys) await putObject(s3, bucket, key, Buffer.from('tekst'), 'text/plain');
    before = await tableCounts(database);
    const made = await runCli(['backup', '--out', out], env);
    if (made.code !== 0) throw new Error(`backup failed: ${made.stderr}`);
    backupDir = join(out, JSON.parse(made.stdout).backup);
  }, 120_000);

  afterAll(async () => {
    await dropDatabase(database);
    await removeBucket(s3, bucket);
    if (out) await rm(out, { recursive: true, force: true });
  }, 60_000);

  it('[NFR-002] the backup records each table’s real row count, whatever the rows’ texts hold', async () => {
    // Act
    const manifest = JSON.parse(await readFile(join(backupDir, 'MANIFEST.json'), 'utf8'));
    // Assert
    expect(manifest.database.tables).toMatchObject({
      'public."H5PContent"': 1,
      'public."H5PUserData"': 30,
      'public."H5PContentFile"': 2,
    });
    expect(manifest.database.tables).toEqual(before);
  });

  it('[NFR-002] the restore of it finds no table differing and no content file missing', async () => {
    // Arrange: wipe both, as after losing them
    await dropDatabase(database);
    await createDatabase(database);
    await removeBucket(s3, bucket);
    await createBucket(s3, bucket);
    // Act
    const restored = await runCli(['restore', '--from', backupDir], env);
    // Assert
    expect(restored.code, restored.stderr).toBe(0);
    expect(JSON.parse(restored.stdout)).toMatchObject({
      tablesDiffering: 0,
      differingTables: [],
      objectsDiffering: 0,
      contentFilesMissing: 0,
      ok: true,
    });
    expect(await tableCounts(database)).toEqual(before);
    expect(await listKeys(s3, bucket)).toEqual([...keys].sort());
  }, 120_000);

  it('[NFR-002] a content file’s key is compared as it is, also with a line break and a bar in it', async () => {
    // Arrange: a third row whose key holds a line break; its object counts as restored, then as absent
    await sql(
      `INSERT INTO "H5PContentFile" (id, "contentId", filename, "s3Key", size, sha256) VALUES ` +
        `(gen_random_uuid(), '${contentId}', 'fil-2.txt', E'${brokenLine.replace('\n', '\\n')}', 5, 'x')`,
    );
    // Act
    const allThere = await missingContentFiles(pgEnv(database), new Set([...keys, brokenLine]));
    const oneAbsent = await missingContentFiles(pgEnv(database), new Set(keys));
    const twoAbsent = await missingContentFiles(pgEnv(database), new Set([keys[1]]));
    // Assert
    expect([allThere, oneAbsent, twoAbsent]).toEqual([0, 1, 2]);
  }, 60_000);
});
