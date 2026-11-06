/**
 * roleDatabase — a throwaway PostgreSQL database set up with D-109's three roles, for tests that connect as each.
 *
 * Why: DATA-010's roles are proven only by logging in as them. The shared test database belongs to the development
 *      user, so the roles get a database of their own, set up as a deployment does it: `01-roles.sql` as the local
 *      superuser, the real `prisma migrate deploy` as `hvli_migrator`, then `02-grants.sql` as `hvli_migrator`.
 * Spec: DATA-010
 * Invariants:
 *   - The database name is unique per run; `close` disconnects every client and drops it (WITH FORCE).
 *   - Roles are cluster-wide, so they are kept, with the fixed development-only password `TEST_ROLE_PASSWORD`:
 *     parallel runs never change each other's logins, and the roles hold privileges only in throwaway databases.
 *     Production passwords are set by HVL's database administrator (docs/ops/database-roles.md).
 *   - Runs only against a server on this machine (`isLocalDatabaseServer`): on another one it would reset real
 *     roles' passwords to that published value (D-109 amendment of 2026-11-05).
 *   - Needs the services' database user to be a superuser, as `hvli` is in development and CI (docker-compose.yml,
 *     .github/workflows/ci.yml).
 * Collaborators: ../../src/infra/databaseRolesCli.ts, ../../prisma/roles/, ./services.ts.
 * Tests: apps/server/test/db/databaseRoles.int.test.ts
 */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { applyDatabaseRoleScript } from '../../src/infra/databaseRolesCli.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { serviceEnv, uniqueName } from './services.js';

/** The roles 01-roles.sql creates. */
export const DATABASE_ROLES = ['hvli_migrator', 'hvli_app', 'hvli_analytics'] as const;

/** One of D-109's roles. */
export type DatabaseRole = (typeof DATABASE_ROLES)[number];

/** The roles' password in development and CI only; never a production value. */
export const TEST_ROLE_PASSWORD = 'hvli-roles-test-only';

/** PostgreSQL's SQLSTATE for "insufficient privilege" (also "must be owner of …"). */
export const REFUSED = '42501';

/** A throwaway database with the roles set up, and a client per role. */
export interface RoleDatabase {
  readonly name: string;
  /** The local superuser, connected to the throwaway database. */
  readonly admin: Database;
  readonly migrator: Database;
  readonly app: Database;
  readonly analytics: Database;
  /** A further client for a role; `readWrite` turns off the analytics role's read-only default for the session. */
  as(role: DatabaseRole, options?: { readWrite?: boolean }): Database;
  close(): Promise<void>;
}

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js');

const urlOf = (base: string, database: string, role?: DatabaseRole, readWrite = false): string => {
  const url = new URL(base);
  url.pathname = `/${database}`;
  if (role) [url.username, url.password] = [role, TEST_ROLE_PASSWORD];
  if (readWrite) url.searchParams.set('options', '-c default_transaction_read_only=off');
  return url.toString();
};

/**
 * Tells whether a connection URL reaches a PostgreSQL server on this machine.
 * @param url - A `postgresql://` URL.
 * @returns True for `localhost`, a `127.x` address, `::1` or a socket (as node-postgres reads the URL).
 */
export function isLocalDatabaseServer(url: string): boolean {
  try {
    const parsed = new URL(url);
    // WHY: node-postgres connects to the last `host` query parameter when there is one (pg-connection-string).
    const host = parsed.searchParams.getAll('host').at(-1) || parsed.hostname;
    return (
      host === '' ||
      host.startsWith('/') ||
      ['localhost', '[::1]', '::1'].includes(host) ||
      /^127\./.test(host)
    );
  } catch {
    return false;
  }
}

/**
 * Creates a throwaway database and sets up the roles in it, as a deployment does.
 * @returns The database and a client per role; call `close` when done.
 * @throws Error before touching anything when the server is not on this machine.
 */
export async function openRoleDatabase(): Promise<RoleDatabase> {
  const base = serviceEnv().DATABASE_URL;
  // SECURITY: the roles are cluster-wide and get a published password below (D-109 amendment of 2026-11-05).
  if (!isLocalDatabaseServer(base)) {
    throw new Error(
      'The role test sets cluster-wide role passwords; it runs only against a local PostgreSQL.',
    );
  }
  const name = uniqueName('roles').replaceAll('-', '_');
  const server = createPrismaClient(base);
  await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  const clients: Database[] = [];
  const as = (role?: DatabaseRole, options: { readWrite?: boolean } = {}): Database => {
    const client = createPrismaClient(urlOf(base, name, role, options.readWrite));
    clients.push(client);
    return client;
  };
  const close = async (): Promise<void> => {
    await Promise.all(clients.map((client) => client.$disconnect()));
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await server.$disconnect();
  };
  try {
    const admin = as();
    await applyDatabaseRoleScript(admin, 'roles');
    for (const role of DATABASE_ROLES) {
      await admin.$executeRawUnsafe(`ALTER ROLE ${role} PASSWORD '${TEST_ROLE_PASSWORD}'`);
    }
    await promisify(execFile)(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: urlOf(base, name, 'hvli_migrator') },
    });
    const migrator = as('hvli_migrator');
    await applyDatabaseRoleScript(migrator, 'grants');
    return { name, admin, migrator, app: as('hvli_app'), analytics: as('hvli_analytics'), as, close };
  } catch (error) {
    // WHY: a failed set-up must not leave a database behind on the shared server.
    await close();
    throw error;
  }
}

/**
 * Runs a query and returns PostgreSQL's SQLSTATE if it fails.
 * @param query - A Prisma query (it runs when awaited here).
 * @returns `ok`, the SQLSTATE (e.g. `42501`), or `unknown: <message>` for an error without one.
 */
export async function sqlStateOf(query: PromiseLike<unknown>): Promise<string> {
  try {
    await query;
    return 'ok';
  } catch (error) {
    const cause = (error as { meta?: { driverAdapterError?: { cause?: { code?: string } } } }).meta
      ?.driverAdapterError?.cause;
    return cause?.code ?? `unknown: ${(error as Error).message}`;
  }
}
