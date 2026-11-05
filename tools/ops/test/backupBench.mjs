/**
 * backupBench — what the backup round-trip test needs around the CLI: the local services, a database of its own
 * migrated with the server's real migrations, seeded rows, a bucket with known objects, and the CLI run as operations
 * run it.
 *
 * Why: NFR-002's restore must be shown to bring back what a backup holds (D-110's backup amendment of 2026-11-05):
 *      the test seeds, backs up, wipes, restores and compares, against the same PostgreSQL 16 and S3 emulator the
 *      server's integration tests use (D-023), never the shared development database itself.
 * Spec: NFR-002
 * Invariants:
 *   - Runs only against a PostgreSQL server on this machine; each database and bucket has a name of this run and is
 *     dropped by `dropDatabase` and `removeBucket`.
 *   - The CLI gets only `PATH` and the variables the test names, as on an operations host.
 *   - Locally, without the services' variables, the tests are skipped; in CI (`CI=true`) that is an error.
 * Collaborators: ../backupCli.mjs, ../postgresDump.mjs (`psqlRows`), ../bucketBackup.mjs, apps/server/prisma.
 * Tests: tools/ops/test/backupRoundTrip.test.mjs
 */
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createS3, s3Settings } from '../bucketBackup.mjs';
import { isLoopbackHost, libpqEnv, toolEnv } from '../postgresConnection.mjs';
import { psqlRows } from '../postgresDump.mjs';

const SERVER_DIR = fileURLToPath(new URL('../../../apps/server/', import.meta.url));
const CLI = fileURLToPath(new URL('../backupCli.mjs', import.meta.url));
const serverRequire = createRequire(`${SERVER_DIR}package.json`);
const sdk = () => serverRequire('@aws-sdk/client-s3');

// WHY: locally the services' locations are in apps/server/.env, as for the server's own integration tests (D-023).
if (!process.env.DATABASE_URL && existsSync(`${SERVER_DIR}.env`)) process.loadEnvFile(`${SERVER_DIR}.env`);

const NEEDED = ['DATABASE_URL', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const missing = NEEDED.filter((name) => !process.env[name]);
if (missing.length > 0 && process.env.CI === 'true') {
  throw new Error(`CI must run the backup round trip; missing ${missing.join(', ')}`);
}

/** Whether the services are configured. */
export const servicesConfigured = missing.length === 0;

/** A unique name of this run, safe for a database and a bucket. */
export const runName = (prefix) => `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

/** The environment of the services, as the server has it. */
export const serviceEnv = () => ({
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:5000',
  S3_REGION: process.env.S3_REGION ?? 'eu-north-1',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? '',
  S3_FORCE_PATH_STYLE: 'true',
});

/**
 * The URL of another database on the services' PostgreSQL.
 * @param {string} database - Its name.
 * @returns {string} The URL.
 * @throws {Error} When the server is not on this machine.
 */
export function databaseUrl(database) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!isLoopbackHost(url.hostname)) throw new Error('the round trip runs only against a local PostgreSQL');
  url.pathname = `/${database}`;
  return url.toString();
}

/** The tool environment of a database. */
export const pgEnv = (database) => toolEnv(libpqEnv(databaseUrl(database)).env, process.env.PATH);

/**
 * Runs SQL as the services' administrator on its own database.
 * @param {string} sql - A statement.
 */
export const adminSql = (sql) =>
  psqlRows(toolEnv(libpqEnv(process.env.DATABASE_URL).env, process.env.PATH), sql);

/**
 * Creates an empty database, optionally with the server's migrations applied.
 * @param {string} name - Its name (lower case, digits and `_`).
 * @param {{migrate?: boolean}} [options] - Whether to run `prisma migrate deploy`.
 */
export async function createDatabase(name, { migrate = false } = {}) {
  await adminSql(`CREATE DATABASE "${name}"`);
  if (!migrate) return;
  await promisify(execFile)(
    process.execPath,
    [serverRequire.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: databaseUrl(name) },
    },
  );
}

/** Drops a database of this run. */
export const dropDatabase = (name) => adminSql(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);

/**
 * Every table's row count in `public`, by its name as `pg_dump` writes it.
 * @param {string} database - The database.
 * @returns {Promise<Record<string, number>>} Counts.
 */
export async function tableCounts(database) {
  const env = pgEnv(database);
  const names = await psqlRows(
    env,
    "SELECT format('%I.%I', schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
  );
  if (names.length === 0) return {};
  const sql = names.map(([name]) => `SELECT '${name}', count(*) FROM ${name}`).join(' UNION ALL ');
  return Object.fromEntries((await psqlRows(env, sql)).map(([name, rows]) => [name, Number(rows)]));
}

/** An S3 client for the services. */
export const s3Client = () => createS3(s3Settings({ ...serviceEnv(), S3_CONTENT_BUCKET: 'hvli-content' }));

/** Creates an empty bucket. */
export const createBucket = (s3, Bucket) => s3.send(new (sdk().CreateBucketCommand)({ Bucket }));

/** Puts one object. */
export const putObject = (s3, Bucket, Key, Body, ContentType) =>
  s3.send(new (sdk().PutObjectCommand)({ Bucket, Key, Body, ContentType }));

/**
 * Reads one object whole.
 * @returns {Promise<Buffer>} Its bytes.
 */
export async function getObject(s3, Bucket, Key) {
  const answer = await s3.send(new (sdk().GetObjectCommand)({ Bucket, Key }));
  return Buffer.from(await answer.Body.transformToByteArray());
}

/** Lists a bucket's keys. */
export const listKeys = async (s3, Bucket) =>
  ((await s3.send(new (sdk().ListObjectsV2Command)({ Bucket }))).Contents ?? []).map((o) => o.Key).sort();

/** Deletes a bucket of this run and every object in it. */
export async function removeBucket(s3, Bucket) {
  for (const Key of await listKeys(s3, Bucket).catch(() => [])) {
    await s3.send(new (sdk().DeleteObjectCommand)({ Bucket, Key }));
  }
  await s3.send(new (sdk().DeleteBucketCommand)({ Bucket })).catch(() => undefined);
}

/**
 * Runs the backup CLI in a process of its own with only `PATH` and `env`.
 * @param {string[]} args - Its arguments.
 * @param {Record<string, string>} env - Its environment.
 * @returns {Promise<{code: number | null, stdout: string, stderr: string}>} How it ended.
 */
export function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { PATH: process.env.PATH ?? '', ...env } });
    const [out, err] = [[], []];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      }),
    );
  });
}
