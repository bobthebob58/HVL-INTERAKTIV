/**
 * postgresDump — the database half of a backup and a restore: PostgreSQL's versions, the dump, its exact row counts,
 * the empty-target check, the restore, and the counts and content-file check afterwards.
 *
 * Why: NFR-002 asks for daily backups and a tested restore. D-110's backup amendment of 2026-11-05 uses PostgreSQL's
 *      own tools, so HVL's database administrator can read and repeat every step, and reads the row counts from the
 *      dump itself, so they describe exactly the snapshot `pg_dump` took, also while the server writes.
 * Spec: NFR-002
 * Invariants:
 *   - Every tool runs with `toolEnv` only (./postgresConnection.mjs); no password is ever an argument.
 *   - Table names come from the dump's `COPY` lines and must look like `schema."Table"` or `schema.table` before
 *     they are put into a query, so a changed dump cannot inject SQL through a name.
 *   - A restore goes only into a database with no table, view or sequence in `public` or `analytics`.
 *   - The restore is one transaction (`--single-transaction --exit-on-error`): it lands whole or not at all.
 * Collaborators: ./toolProcess.mjs, ./postgresConnection.mjs, ./backupRun.mjs.
 * Tests: tools/ops/test/backupRoundTrip.test.mjs, tools/ops/test/postgresConnection.test.mjs
 */
import { BackupConfigError, serverMajor, toolMajor } from './postgresConnection.mjs';
import { runTool } from './toolProcess.mjs';

/** A table name as `pg_dump` writes it in a `COPY` line. */
export const TABLE_NAME = /^[a-z_][a-z0-9_]*\.("[A-Za-z_][A-Za-z0-9_]*"|[a-z_][a-z0-9_]*)$/;

const COPY_LINE = /^COPY (\S+) (?:\(.*\) )?FROM stdin;$/;

/**
 * Runs one SQL statement with psql and returns its rows.
 * @param {Record<string, string>} env - The tool environment.
 * @param {string} sql - The statement (never user input).
 * @returns {Promise<string[][]>} Each row's fields.
 */
export async function psqlRows(env, sql) {
  const args = ['--no-psqlrc', '--tuples-only', '--no-align', '--field-separator=|', '--set=ON_ERROR_STOP=1'];
  const out = await runTool('psql', [...args, '--command', sql], env);
  return out
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split('|'));
}

/**
 * Checks that `pg_dump`, `pg_restore` and the server share one major version.
 * @param {Record<string, string>} env - The tool environment.
 * @returns {Promise<number>} The major version.
 * @throws {BackupConfigError} When the versions differ or cannot be read.
 */
export async function postgresMajor(env) {
  const dump = toolMajor(await runTool('pg_dump', ['--version'], env));
  const restore = toolMajor(await runTool('pg_restore', ['--version'], env));
  const server = serverMajor((await psqlRows(env, 'SHOW server_version_num'))[0]?.[0] ?? '');
  if (dump === undefined || dump !== restore || dump !== server) {
    throw new BackupConfigError(
      `pg_dump ${dump ?? '?'}, pg_restore ${restore ?? '?'} and the server ${server ?? '?'} must have the same ` +
        'PostgreSQL major version; use the client tools of the server’s version',
    );
  }
  return dump;
}

/**
 * Dumps the database in PostgreSQL's custom format.
 * @param {Record<string, string>} env - The tool environment.
 * @param {string} file - The dump file to write (mode 0600).
 */
export const dumpDatabase = (env, file) => runTool('pg_dump', ['--format=custom'], env, { toFile: file });

/**
 * Counts the rows of every table in a dump, from its `COPY` blocks (one line per row in COPY's text format).
 * @param {Record<string, string>} env - The tool environment (pg_restore reads the file, not the server).
 * @param {string} file - The dump.
 * @returns {Promise<Record<string, number>>} Table name → rows, for every table, empty ones included.
 * @throws {Error} When a table name is not one `TABLE_NAME` accepts.
 */
export async function countDumpRows(env, file) {
  const counts = {};
  let current;
  let strange;
  await runTool('pg_restore', ['--data-only', '--file=-', file], env, {
    onLine: (line) => {
      if (current !== undefined) {
        if (line === '\\.') current = undefined;
        else counts[current] += 1;
        return;
      }
      const name = COPY_LINE.exec(line)?.[1];
      if (name === undefined) return;
      if (!TABLE_NAME.test(name)) strange = true;
      current = name;
      counts[name] = 0;
    },
  });
  if (strange) throw new Error('the dump names a table this tool does not recognise');
  return counts;
}

/**
 * Refuses a target database that already holds anything of ours.
 * @param {Record<string, string>} env - The tool environment of the target.
 * @throws {BackupConfigError} When `public` or `analytics` has a table, view or sequence.
 */
export async function assertEmptyDatabase(env) {
  const [[count] = ['0']] = await psqlRows(
    env,
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('public', " +
      "'analytics') AND c.relkind IN ('r', 'p', 'v', 'm', 'S')",
  );
  if (Number(count) > 0) {
    throw new BackupConfigError(
      'the database DATABASE_URL names is not empty; restore only into a new, empty database (docs/ops/runbook.md)',
    );
  }
}

/**
 * Restores a dump in one transaction, without the original owners and grants (`db:roles -- grants` sets those).
 * @param {Record<string, string>} env - The tool environment of the target.
 * @param {string} file - The dump.
 */
export const restoreDatabase = (env, file) =>
  runTool(
    'pg_restore',
    [
      '--no-owner',
      '--no-privileges',
      '--single-transaction',
      '--exit-on-error',
      `--dbname=${env.PGDATABASE}`,
      file,
    ],
    env,
  );

/**
 * Counts the rows of the named tables.
 * @param {Record<string, string>} env - The tool environment.
 * @param {string[]} tables - Names from a dump's manifest.
 * @returns {Promise<Record<string, number>>} Table name → rows; a table that is missing is left out.
 * @throws {Error} When a name is not one `TABLE_NAME` accepts.
 */
export async function countTables(env, tables) {
  if (tables.length === 0) return {};
  if (!tables.every((name) => TABLE_NAME.test(name))) throw new Error('a manifest names an unknown table');
  const present = new Set(
    (
      await psqlRows(
        env,
        `SELECT n FROM unnest(ARRAY[${tables.map((t) => `'${t}'`).join(', ')}]) AS n
      WHERE to_regclass(n) IS NOT NULL`,
      )
    ).map(([name]) => name),
  );
  const counted = tables.filter((name) => present.has(name));
  if (counted.length === 0) return {};
  const sql = counted.map((name) => `SELECT '${name}', count(*) FROM ${name}`).join(' UNION ALL ');
  return Object.fromEntries((await psqlRows(env, sql)).map(([name, rows]) => [name, Number(rows)]));
}

/**
 * Counts the content-file rows whose object is not among the restored keys.
 * @param {Record<string, string>} env - The tool environment.
 * @param {Set<string>} keys - The object keys the backup restored.
 * @returns {Promise<number>} How many `H5PContentFile` rows have no object (0 without that table).
 */
export async function missingContentFiles(env, keys) {
  const [[exists] = ['']] = await psqlRows(env, `SELECT to_regclass('public."H5PContentFile"') IS NOT NULL`);
  if (exists !== 't') return 0;
  const rows = await psqlRows(env, 'SELECT "s3Key" FROM public."H5PContentFile"');
  return rows.filter(([key]) => !keys.has(key)).length;
}
