/**
 * backupRestoreChecks.test — the restore's own checks in the direction a drill depends on: a bucket that is not empty
 * is refused before anything is written, and a restore whose row counts or objects differ from the manifest, or whose
 * content-file rows have no object, reports each difference and exits 1; and a backup removes the partial folder a
 * stopped run left behind.
 * Spec: NFR-002
 */
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeChecksums } from '../backupFolder.mjs';
import { psqlRows } from '../postgresDump.mjs';
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
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const STOPPED_RUN = '.hvli-backup-20200101T000000Z.partial';

describeWithServices('the restore checks its own result (NFR-002)', () => {
  const source = runName('hvli_checks').replaceAll('-', '_');
  const targets = [`${source}_full_bucket`, `${source}_differs`];
  const buckets = [runName('test-checks'), runName('test-checks-full'), runName('test-checks-differs')];
  const contentId = randomUUID();
  const files = { [`content/${contentId}/a.png`]: 'png bytes', [`content/${contentId}/b.txt`]: 'tekst' };
  const s3 = s3Client();
  const env = (database, bucket) => ({
    ...serviceEnv(),
    DATABASE_URL: databaseUrl(database),
    S3_CONTENT_BUCKET: bucket,
  });
  let out;
  let backupDir;
  let backupSummary;

  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'hvli-backup-checks-'));
    await createDatabase(source, { migrate: true });
    const owner = randomUUID();
    const rows = Object.entries(files)
      .map(
        ([key, body]) =>
          `(gen_random_uuid(), '${contentId}', '${key.split('/').pop()}', '${key}', ${body.length}, '${sha256(body)}')`,
      )
      .join(', ');
    for (const sql of [
      `INSERT INTO "User" (id, kind) VALUES ('${owner}', 'staff')`,
      `INSERT INTO "H5PContent" (id, "mainLibrary", title, params, metadata, "ownerUserId", "updatedAt") VALUES ` +
        `('${contentId}', 'H5P.MultiChoice 1.16', 'Kopi', '{}', '{"title":"Kopi"}', '${owner}', now())`,
      `INSERT INTO "H5PContentFile" (id, "contentId", filename, "s3Key", size, sha256) VALUES ${rows}`,
    ])
      await psqlRows(pgEnv(source), sql);
    await createBucket(s3, buckets[0]);
    for (const [key, body] of Object.entries(files)) await putObject(s3, buckets[0], key, Buffer.from(body));
    // A run that was stopped (SIGKILL, a reboot) long ago left its partial folder behind.
    await mkdir(join(out, STOPPED_RUN, 'objects'), { recursive: true });
    await writeFile(join(out, STOPPED_RUN, 'database.dump'), 'rows of a stopped run');
    const made = await runCli(['backup', '--out', out], env(source, buckets[0]));
    if (made.code !== 0) throw new Error(`backup failed: ${made.stderr}`);
    backupSummary = JSON.parse(made.stdout);
    backupDir = join(out, backupSummary.backup);
    for (const name of targets) await createDatabase(name);
    for (const bucket of buckets.slice(1)) await createBucket(s3, bucket);
  }, 120_000);

  afterAll(async () => {
    for (const name of [source, ...targets]) await dropDatabase(name);
    for (const bucket of buckets) await removeBucket(s3, bucket);
    if (out) await rm(out, { recursive: true, force: true });
  }, 60_000);

  it('[NFR-002] removes the partial folder a stopped run left, as part of the retention', async () => {
    // Act
    const left = await readdir(out);

    // Assert
    expect(left).not.toContain(STOPPED_RUN);
    expect(left).toContain(backupSummary.backup);
    expect(backupSummary.removedExpired).toBe(1);
  });

  it('[NFR-002] refuses a bucket that is not empty, before it writes a row', async () => {
    // Arrange: an empty database, and a bucket that already holds one object
    await putObject(s3, buckets[1], 'content/other/kept.txt', Buffer.from('x'));

    // Act
    const restored = await runCli(['restore', '--from', backupDir], env(targets[0], buckets[1]));

    // Assert
    expect(restored.code).toBe(1);
    expect(JSON.parse(restored.stderr).error).toMatch(/S3_CONTENT_BUCKET names is not empty/);
    expect(await tableCounts(targets[0])).toEqual({});
    expect(await listKeys(s3, buckets[1])).toEqual(['content/other/kept.txt']);
  }, 60_000);

  it('[NFR-002] reports a differing table, a differing object and a content file without its object', async () => {
    // Arrange: a copy whose manifest (checksums made again) expects one more user, a larger a.png and no b.txt
    const copy = join(out, 'differs', 'hvli-backup-20261105T030000Z');
    await cp(backupDir, copy, { recursive: true });
    const manifest = JSON.parse(await readFile(join(copy, 'MANIFEST.json'), 'utf8'));
    manifest.database.tables['public."User"'] += 1;
    const objects = manifest.buckets.content.objects.filter((o) => !o.key.endsWith('/b.txt'));
    objects[0].size += 1;
    manifest.buckets.content.objects = objects;
    await writeFile(join(copy, 'MANIFEST.json'), JSON.stringify(manifest));
    await writeChecksums(copy);

    // Act
    const restored = await runCli(['restore', '--from', copy], env(targets[1], buckets[2]));

    // Assert
    expect(restored.code, restored.stderr).toBe(1);
    expect(JSON.parse(restored.stdout)).toMatchObject({
      tablesDiffering: 1,
      objectsDiffering: 1,
      contentFilesMissing: 1,
      ok: false,
    });
  }, 60_000);
});
