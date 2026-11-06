/**
 * postgresConnection — turns the server's `DATABASE_URL` into the environment of PostgreSQL's own client tools
 * (`pg_dump`, `pg_restore`, `psql`), and checks the rules a backup connection must keep.
 *
 * Why: NFR-002's backups and restore drill run PostgreSQL's tools with the same URL the server and the migrate step
 *      use (D-110's backup amendment of 2026-11-05). A password in a command line is visible to every user of the
 *      host (`ps`), so the tools get it only through their own environment; and a whole-database copy over a
 *      connection that does not check the server would hand every row to whoever sits in between (DATA-004).
 * Spec: NFR-002, DATA-004
 * Invariants:
 *   - The tools' environment holds `PATH`, `LC_ALL=C` and the `PG*` values of the URL only, so nothing of the
 *     caller's shell (a `PGSERVICE`, a `~/.pgpass`) can point them at another database.
 *   - A host other than the loopback or a local socket needs `sslmode=verify-full` or `verify-ca`; Prisma's
 *     `sslmode=require&sslaccept=strict` (the migration URL of docs/ops/database-roles.md) counts as `verify-full`.
 *     Without `sslrootcert` the system's CAs are used (`PGSSLROOTCERT=system`, libpq 16).
 *   - Errors name the variable and the rule, never the URL, a user name or a password.
 * Collaborators: ./postgresDump.mjs, ./backupRun.mjs.
 * Tests: tools/ops/test/postgresConnection.test.mjs
 */

/** The `sslmode` values that encrypt and check the server's certificate. */
export const VERIFYING_SSL_MODES = Object.freeze(['verify-full', 'verify-ca']);

/** The PostgreSQL major version the server runs (spec 01's stack, CLAUDE.md §2). */
export const POSTGRES_MAJOR = 16;

/** An error whose message is safe to print: it names a variable or a rule, never a value. */
export class BackupConfigError extends Error {
  /** @param {string} message - What is wrong, naming no value. */
  constructor(message) {
    super(message);
    this.name = 'BackupConfigError';
  }
}

const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?)$/i;

/**
 * Whether a host is this machine, so a connection to it never crosses a network.
 * @param {string} host - A host name, an IP address or a socket folder.
 * @returns {boolean} True for `localhost`, `127.0.0.0/8`, `::1` and a socket folder (`/…`).
 */
export const isLoopbackHost = (host) => host === '' || host.startsWith('/') || LOOPBACK.test(host);

const lastParam = (url, name) => url.searchParams.getAll(name).at(-1);

/**
 * The libpq environment for a connection URL.
 * @param {string | undefined} databaseUrl - `DATABASE_URL`, as the server reads it.
 * @param {string} [variable] - The variable's name, for messages.
 * @returns {{env: Record<string, string>, database: string, loopback: boolean}} The tools' environment (without
 *   `PATH`), the database name, and whether the host is this machine.
 * @throws {BackupConfigError} When the URL is missing or unreadable, names no database, or would not be encrypted
 *   and checked although it leaves this machine.
 */
export function libpqEnv(databaseUrl, variable = 'DATABASE_URL') {
  if (!databaseUrl) throw new BackupConfigError(`${variable} is not set (apps/server/.env.example)`);
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new BackupConfigError(`${variable} is not a URL`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new BackupConfigError(`${variable} is not a postgresql:// URL`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new BackupConfigError(`${variable} names no database`);
  const host = decodeURIComponent(lastParam(url, 'host') ?? url.hostname);
  const loopback = isLoopbackHost(host);
  let sslmode = lastParam(url, 'sslmode');
  // WHY: Prisma's CLI ignores verify-full and checks the certificate with `sslaccept=strict` instead (D-109), so the
  // migration URL says `require` with it; libpq's `require` would not check, so it becomes libpq's verify-full.
  if (sslmode === 'require' && lastParam(url, 'sslaccept') === 'strict') sslmode = 'verify-full';
  if (!loopback && !VERIFYING_SSL_MODES.includes(sslmode ?? '')) {
    throw new BackupConfigError(
      `${variable}: a database on another host needs sslmode=verify-full (or verify-ca), so the copy is encrypted ` +
        'and the server checked (DATA-004)',
    );
  }
  const env = {
    PGHOST: host || 'localhost',
    PGPORT: url.port || '5432',
    PGDATABASE: database,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: sslmode ?? 'prefer',
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'hvli-backup',
  };
  const rootCert = lastParam(url, 'sslrootcert');
  if (VERIFYING_SSL_MODES.includes(env.PGSSLMODE)) env.PGSSLROOTCERT = rootCert ?? 'system';
  else if (rootCert) env.PGSSLROOTCERT = rootCert;
  if (!env.PGUSER) delete env.PGUSER;
  if (!env.PGPASSWORD) delete env.PGPASSWORD;
  return { env, database, loopback };
}

/**
 * The environment a PostgreSQL tool runs with: the connection's values and a `PATH`, nothing else.
 * @param {Record<string, string>} connectionEnv - From `libpqEnv`.
 * @param {string | undefined} path - The caller's `PATH`.
 * @returns {Record<string, string>} The child's whole environment.
 */
export const toolEnv = (connectionEnv, path) => ({
  PATH: path ?? '/usr/bin:/bin',
  LC_ALL: 'C',
  ...connectionEnv,
});

/**
 * The major version in a tool's `--version` line, e.g. `pg_dump (PostgreSQL) 16.15 (Ubuntu …)`.
 * @param {string} text - The tool's output.
 * @returns {number | undefined} The major version, or undefined when the line is not PostgreSQL's.
 */
export function toolMajor(text) {
  const match = /\(PostgreSQL\)\s+(\d+)(?:\.\d+)?/.exec(text);
  return match ? Number(match[1]) : undefined;
}

/**
 * The major version of a server from `SHOW server_version_num` (e.g. `160015`).
 * @param {string} text - The query's answer.
 * @returns {number | undefined} The major version, or undefined for an unreadable answer.
 */
export function serverMajor(text) {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 100000 ? Math.floor(value / 10000) : undefined;
}
