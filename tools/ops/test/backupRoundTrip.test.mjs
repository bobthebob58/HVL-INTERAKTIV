/**
 * backupRoundTrip.test — seeds a database migrated with the server's real migrations and a bucket, backs both up
 * with the CLI, wipes them, restores, and compares every table's row count and the objects' SHA-256.
 * Spec: NFR-002, DATA-009
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { psqlRows } from '../postgresDump.mjs';
import {
  createBucket,
  createDatabase,
  databaseUrl,
  dropDatabase,
  getObject,
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
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

describeWithServices('the backup round trip (NFR-002)', () => {
  const database = runName('hvli_backup').replaceAll('-', '_');
  const spare = `${database}_spare`;
  const bucket = runName('test-backup');
  const contentId = randomUUID();
  const image = randomBytes(300 * 1024);
  const objects = {
    [`content/${contentId}/images/foto.png`]: { body: image, type: 'image/png' },
    [`content/${contentId}/Lærar øving (1).txt`]: { body: Buffer.from('æ ø å\n'), type: 'text/plain' },
  };
  const s3 = s3Client();
  const env = (db = database) => ({
    ...serviceEnv(),
    DATABASE_URL: databaseUrl(db),
    S3_CONTENT_BUCKET: bucket,
  });
  const runs = [];
  const cli = async (args, cliEnv) => {
    const run = await runCli(args, cliEnv);
    runs.push(run);
    return run;
  };
  let out;
  let before;
  let backupDir;

  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'hvli-backup-test-'));
    await createDatabase(database, { migrate: true });
    await seed(database, contentId, objects);
    await createBucket(s3, bucket);
    for (const [key, { body, type }] of Object.entries(objects)) await putObject(s3, bucket, key, body, type);
    before = await tableCounts(database);
    const made = await cli(['backup', '--out', out], env());
    if (made.code !== 0) throw new Error(`backup failed: ${made.stderr}`);
    backupDir = join(out, JSON.parse(made.stdout).backup);
  }, 120_000);

  afterAll(async () => {
    await dropDatabase(database);
    await dropDatabase(spare);
    await removeBucket(s3, bucket);
    if (out) await rm(out, { recursive: true, force: true });
  }, 60_000);

  it('[NFR-002] restores every row and object of a backup into an emptied database and bucket', async () => {
    // Arrange: wipe both, as after losing them
    await dropDatabase(database);
    await createDatabase(database);
    await removeBucket(s3, bucket);
    await createBucket(s3, bucket);

    // Act
    const restored = await cli(['restore', '--from', backupDir], env());

    // Assert
    expect(restored.code, restored.stderr).toBe(0);
    const summary = JSON.parse(restored.stdout);
    expect(summary).toMatchObject({
      tablesDiffering: 0,
      objectsDiffering: 0,
      contentFilesMissing: 0,
      ok: true,
    });
    expect(await tableCounts(database)).toEqual(before);
    expect(before['public."XapiStatement"']).toBe(250);
    expect(before['public._prisma_migrations']).toBeGreaterThan(0);
    expect(await listKeys(s3, bucket)).toEqual(Object.keys(objects).sort());
    expect(sha256(await getObject(s3, bucket, `content/${contentId}/images/foto.png`))).toBe(sha256(image));
  }, 120_000);

  it('[NFR-002] refuses to restore into a database or bucket that is not empty', async () => {
    // Act: the database holds the seeded or the restored rows
    const again = await cli(['restore', '--from', backupDir], env());

    // Assert
    expect(again.code).toBe(1);
    expect(JSON.parse(again.stderr).error).toMatch(/DATABASE_URL names is not empty/);
    expect(await tableCounts(database)).toEqual(before);
  }, 60_000);

  it('[NFR-002] refuses a backup whose dump was changed, and writes nothing', async () => {
    // Arrange: a copy with one byte of the dump changed, and an empty target database
    const copy = join(out, 'changed', 'hvli-backup-20261105T030000Z');
    await cp(backupDir, copy, { recursive: true });
    const dump = await readFile(join(copy, 'database.dump'));
    dump[dump.length - 10] ^= 0xff;
    await writeFile(join(copy, 'database.dump'), dump);
    await createDatabase(spare);

    // Act
    const verified = await cli(['verify', '--from', copy], {});
    const restored = await cli(['restore', '--from', copy], env(spare));

    // Assert
    expect(verified.code).toBe(1);
    expect(JSON.parse(verified.stdout).problems).toEqual(['database.dump has changed']);
    expect(restored.code).toBe(1);
    expect(JSON.parse(restored.stderr).error).toMatch(/database\.dump has changed/);
    expect(await tableCounts(spare)).toEqual({});
  }, 60_000);

  it('[NFR-002] writes the backup for its owner only, under hashes, with a checked list of every file', async () => {
    // Act
    const files = await readdir(backupDir, { recursive: true });
    const verified = await cli(['verify', '--from', backupDir], {});

    // Assert
    expect(JSON.parse(verified.stdout)).toMatchObject({ problems: [], files: 4 });
    expect(files.filter((f) => f.startsWith('objects/')).sort()).toEqual(
      Object.values(objects)
        .map(({ body }) => `objects/${sha256(body)}`)
        .sort(),
    );
    expect((await stat(backupDir)).mode & 0o077).toBe(0);
    expect((await stat(join(backupDir, 'database.dump'))).mode & 0o077).toBe(0);
  });

  it('[DATA-009] never prints the database password, a URL or an object key, also when it fails', async () => {
    // Arrange: a wrong password the server will refuse
    const wrong = new URL(databaseUrl(database));
    wrong.password = `wrong-${randomUUID()}`;

    // Act
    const refused = await cli(['backup', '--out', join(out, 'refused')], {
      ...env(),
      DATABASE_URL: wrong.href,
    });
    await cli(['restore', '--from', backupDir], env());

    // Assert: these runs and every earlier run of this file
    expect(refused.code).toBe(1);
    expect(JSON.parse(refused.stderr).error).toMatch(/^psql exited with code 2/);
    const printed = runs.map((run) => run.stdout + run.stderr).join('\n');
    expect(printed).not.toContain(wrong.password);
    const password = new URL(process.env.DATABASE_URL ?? '').password;
    if (password) expect(printed).not.toContain(password);
    expect(printed).not.toMatch(/postgres(ql)?:\/\/|https?:\/\/|"hvli"/);
    expect(printed).not.toContain(contentId);
  }, 60_000);
});

/** Rows in six tables, among them content-file rows that name the bucket's objects. */
async function seed(database, contentId, objects) {
  const owner = randomUUID();
  const files = Object.entries(objects)
    .map(
      ([key, { body }]) =>
        `(gen_random_uuid(), '${contentId}', '${key.split('/').pop()}', '${key}', ${body.length}, '${sha256(body)}')`,
    )
    .join(', ');
  const statements = [
    `INSERT INTO "User" (id, kind) VALUES ('${owner}', 'staff')`,
    `INSERT INTO "H5PContent" (id, "mainLibrary", title, params, metadata, "ownerUserId", "updatedAt") VALUES ` +
      `('${contentId}', 'H5P.MultiChoice 1.16', 'Kopi', '{"question":"Kva?"}', '{"title":"Kopi"}', '${owner}', now())`,
    `INSERT INTO "H5PContentFile" (id, "contentId", filename, "s3Key", size, sha256) VALUES ${files}`,
    `INSERT INTO "XapiStatement" (id, "contentId", "contentVersion", "learnerKey", verb, "attemptId", timestamp) ` +
      `SELECT gen_random_uuid(), '${contentId}', 1, 'key-' || g, 'answered', '${randomUUID()}:1', now() ` +
      'FROM generate_series(1, 250) AS g',
    `INSERT INTO "H5PUserData" (id, "contentId", "dataType", "learnerKey", data, "updatedAt") ` +
      `SELECT gen_random_uuid(), '${contentId}', 'state', 'key-' || g, '{"progress":1}', now() ` +
      'FROM generate_series(1, 40) AS g',
    `INSERT INTO "AuditEvent" (id, action, "targetType", "targetId") VALUES (gen_random_uuid(), 'content.create', ` +
      `'content', '${contentId}')`,
  ];
  for (const sql of statements) await psqlRows(pgEnv(database), sql);
}
