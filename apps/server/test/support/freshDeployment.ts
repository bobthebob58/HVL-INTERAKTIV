/**
 * freshDeployment — a new, empty PostgreSQL database set up the way docs/ops/database-roles.md tells HVL to: the roles
 * script through `npm run db:roles -- roles` as the administrator, then the migrate step (`views-down`, `prisma
 * migrate deploy`, `grants`) as `hvli_migrator`; the server's CLIs then run against it as `hvli_app`.
 *
 * Why: the operations CLIs must be proven together on a database that only they set up (DATA-010) and that holds no
 *      other test's rows, so the yearly purge can run for real without touching the shared development database
 *      (DATA-003, D-107), and the data-subject CLI can export and erase there (DATA-008, D-108).
 * Spec: DATA-010, DATA-003, DATA-008
 * Invariants:
 *   - Runs only against a PostgreSQL server on this machine (`isLocalDatabaseServer`), because the cluster-wide roles
 *     get the published test password, as in ./roleDatabase.ts.
 *   - The database name is unique per run; `close` disconnects every client and drops it (WITH FORCE).
 *   - Each step's standard output is kept, in order, for the test to check.
 * Collaborators: ./serverCli.ts, ./roleDatabase.ts, ../../src/infra/databaseRolesCli.ts, ../../prisma/roles/.
 * Tests: apps/server/test/privacy/operationsClis.int.test.ts
 */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { isLocalDatabaseServer, TEST_ROLE_PASSWORD, type DatabaseRole } from './roleDatabase.js';
import { runServerCli, SERVER_DIR } from './serverCli.js';
import { serviceEnv, uniqueName } from './services.js';

/** A freshly deployed database. */
export interface FreshDeployment {
  readonly name: string;
  /** The connection URL of the administrator (the services' superuser) and of each role. */
  readonly urls: Readonly<Record<'admin' | DatabaseRole, string>>;
  /** The administrator's client. */
  readonly admin: Database;
  /** What each runner step printed, in order: roles, views-down, grants. */
  readonly steps: readonly string[];
  close(): Promise<void>;
}

const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js');

const urlOf = (base: string, database: string, role?: DatabaseRole): string => {
  const url = new URL(base);
  url.pathname = `/${database}`;
  if (role) [url.username, url.password] = [role, TEST_ROLE_PASSWORD];
  return url.toString();
};

/**
 * Creates a database and deploys it through the runbook's commands.
 * @returns The deployment; call `close` when done.
 * @throws Error before touching anything when the server is not on this machine, or naming the step that failed.
 */
export async function deployFreshDatabase(): Promise<FreshDeployment> {
  const base = serviceEnv().DATABASE_URL;
  // SECURITY: the roles are cluster-wide and get a published password below (D-109 amendment of 2026-11-05).
  if (!isLocalDatabaseServer(base))
    throw new Error('A fresh deployment runs only against a local PostgreSQL.');
  const name = uniqueName('deploy').replaceAll('-', '_');
  const server = createPrismaClient(base);
  await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  const urls = {
    admin: urlOf(base, name),
    hvli_migrator: urlOf(base, name, 'hvli_migrator'),
    hvli_app: urlOf(base, name, 'hvli_app'),
    hvli_analytics: urlOf(base, name, 'hvli_analytics'),
  };
  const admin = createPrismaClient(urls.admin);
  const close = async (): Promise<void> => {
    await admin.$disconnect();
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await server.$disconnect();
  };
  const steps: string[] = [];
  const step = async (args: string[], url: string): Promise<void> => {
    const run = await runServerCli('db:roles', args, { DATABASE_URL: url });
    if (run.code !== 0) throw new Error(`db:roles ${args.join(' ')} exited ${run.code}: ${run.stderr}`);
    steps.push(run.stdout.trim());
  };
  try {
    await step(['roles'], urls.admin);
    for (const role of ['hvli_migrator', 'hvli_app', 'hvli_analytics'] as const) {
      await admin.$executeRawUnsafe(`ALTER ROLE ${role} PASSWORD '${TEST_ROLE_PASSWORD}'`);
    }
    await step(['views-down'], urls.hvli_migrator);
    await promisify(execFile)(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: urls.hvli_migrator },
    });
    await step(['grants'], urls.hvli_migrator);
    return { name, urls, admin, steps, close };
  } catch (error) {
    // WHY: a failed set-up must not leave a database behind on the shared server.
    await close();
    throw error;
  }
}
