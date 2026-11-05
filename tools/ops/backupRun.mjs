/**
 * backupRun — the three operations of the backup CLI: make a backup, verify one, restore one, each returning a
 * summary of counts that is safe to print.
 *
 * Why: NFR-002 asks for daily backups kept 30 days and a restore tested each semester; D-110's backup amendment of
 *      2026-11-05 decides the order (database, then bucket), the checks before a restore (checksums, empty targets,
 *      one PostgreSQL major version) and the checks after it (row counts, objects, content-file rows).
 * Spec: NFR-002
 * Invariants:
 *   - A backup is written as `.<name>.partial` and renamed only when complete; a failed run removes it, and a
 *     later run removes one that a stopped run left (older than a day).
 *   - A restore reads nothing from a folder whose `SHA256SUMS` fails, and writes nothing into a database or bucket
 *     that is not empty.
 *   - Summaries hold names of backups, counts and sizes; never a URL, a key of an object or a row's value.
 * Collaborators: ./postgresConnection.mjs, ./postgresDump.mjs, ./bucketBackup.mjs, ./backupFolder.mjs,
 *   ./backupCli.mjs.
 * Tests: tools/ops/test/backupRoundTrip.test.mjs
 */
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  assertEmptyBucket,
  createS3,
  differingObjects,
  downloadBucket,
  s3Settings,
  uploadObjects,
} from './bucketBackup.mjs';
import {
  backupName,
  expiredBackups,
  readManifest,
  stalePartials,
  verifyChecksums,
  writeChecksums,
  writeManifest,
} from './backupFolder.mjs';
import { BackupConfigError, libpqEnv, toolEnv } from './postgresConnection.mjs';
import {
  assertEmptyDatabase,
  countDumpRows,
  countTables,
  dumpDatabase,
  missingContentFiles,
  postgresMajor,
  restoreDatabase,
} from './postgresDump.mjs';

/** NFR-002's retention. */
export const DEFAULT_KEEP_DAYS = 30;

const sum = (values) => values.reduce((total, value) => total + value, 0);

const connect = (env) => ({
  pg: toolEnv(libpqEnv(env.DATABASE_URL).env, env.PATH),
  s3: s3Settings(env),
});

/**
 * Makes one backup in `outDir` and removes the expired ones there, and the partial folders of stopped runs.
 * @param {{env: Record<string, string | undefined>, outDir: string, keepDays?: number, now?: Date}} options - The
 *   environment (the server's variables), the folder for backups, the retention and the backup's time.
 * @returns {Promise<object>} The backup's name, its tables, rows, objects and bytes, and how many expired backups
 *   and stale partial folders were removed (`removedExpired`).
 * @throws {BackupConfigError} For settings or versions that break a rule; Error when a step fails.
 */
export async function runBackup({ env, outDir, keepDays = DEFAULT_KEEP_DAYS, now = new Date() }) {
  const { pg, s3: settings } = connect(env);
  const major = await postgresMajor(pg);
  const root = resolve(outDir);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const name = backupName(now);
  const partial = join(root, `.${name}.partial`);
  await mkdir(join(partial, 'objects'), { recursive: true, mode: 0o700 });
  let manifest;
  try {
    await dumpDatabase(pg, join(partial, 'database.dump'));
    const tables = await countDumpRows(pg, join(partial, 'database.dump'));
    const objects = await downloadBucket(createS3(settings), settings.bucket, partial);
    manifest = {
      createdAt: now.toISOString(),
      postgresMajor: major,
      database: { file: 'database.dump', tables },
    };
    manifest.buckets = { content: { objects } };
    await writeManifest(partial, manifest);
    await writeChecksums(partial);
    await rename(partial, join(root, name));
  } catch (error) {
    // PRIVACY: a half-written backup holds learner rows; it never stays behind.
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
  const names = await readdir(root);
  const expired = [...expiredBackups(names, now, keepDays), ...stalePartials(names, now)];
  for (const old of expired) await rm(join(root, old), { recursive: true, force: true });
  const { objects } = manifest.buckets.content;
  return {
    backup: name,
    tables: Object.keys(manifest.database.tables).length,
    rows: sum(Object.values(manifest.database.tables)),
    objects: objects.length,
    objectBytes: sum(objects.map((o) => o.size)),
    removedExpired: expired.length,
  };
}

/**
 * Checks a backup's files against its `SHA256SUMS` and reads its manifest.
 * @param {{from: string}} options - The backup folder.
 * @returns {Promise<{backup: string, files: number, problems: string[]}>} The result.
 */
export async function runVerify({ from }) {
  const dir = resolve(from);
  const { files, problems } = await verifyChecksums(dir);
  if (problems.length === 0) await readManifest(dir).catch((error) => problems.push(error.message));
  return { backup: basename(dir), files, problems };
}

/**
 * Restores a backup into the empty database and bucket the environment names, then checks the result.
 * @param {{env: Record<string, string | undefined>, from: string}} options - The environment of the target and the
 *   backup folder.
 * @returns {Promise<object>} Counts of what was restored and of every difference found; `ok` when there is none.
 * @throws {BackupConfigError} When the backup fails its checks, a version differs, or a target is not empty.
 */
export async function runRestore({ env, from }) {
  const dir = resolve(from);
  const checked = await verifyChecksums(dir);
  if (checked.problems.length > 0) {
    throw new BackupConfigError(`the backup failed its checks: ${checked.problems.join('; ')}`);
  }
  const manifest = await readManifest(dir);
  const { pg, s3: settings } = connect(env);
  const major = await postgresMajor(pg);
  if (major !== manifest.postgresMajor) {
    throw new BackupConfigError(
      `the backup is of PostgreSQL ${manifest.postgresMajor}, the target runs ${major}`,
    );
  }
  const s3 = createS3(settings);
  await assertEmptyDatabase(pg);
  await assertEmptyBucket(s3, settings.bucket);
  await restoreDatabase(pg, join(dir, manifest.database.file));
  const { objects } = manifest.buckets.content;
  await uploadObjects(s3, settings.bucket, dir, objects);
  const expected = manifest.database.tables;
  const counted = await countTables(pg, Object.keys(expected));
  const tablesDiffering = Object.keys(expected).filter((table) => counted[table] !== expected[table]).length;
  const objectsDiffering = await differingObjects(s3, settings.bucket, objects);
  const contentFilesMissing = await missingContentFiles(pg, new Set(objects.map((o) => o.key)));
  return {
    restored: basename(dir),
    tables: Object.keys(expected).length,
    rows: sum(Object.values(counted)),
    objects: objects.length,
    tablesDiffering,
    objectsDiffering,
    contentFilesMissing,
    ok: tablesDiffering === 0 && objectsDiffering === 0 && contentFilesMissing === 0,
  };
}
