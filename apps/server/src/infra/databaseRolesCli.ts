/**
 * databaseRolesCli — runs one of the database role scripts in apps/server/prisma/roles: `roles` (HVL's database
 * administrator, once per database), `views-down` (`hvli_migrator`, right before every `prisma migrate deploy`) or
 * `grants` (`hvli_migrator`, right after it). Run from apps/server:
 * `DATABASE_URL=<that run's URL> npm run --silent db:roles -- grants`.
 *
 * Why: DATA-010 asks for separate roles for the app, for migrations and for read-only analytics (D-109 and its
 *      amendment of 2026-11-04). The scripts are plain SQL that an administrator can read and run with psql; this
 *      runner lets a deployment step run them with the server's own database client, without psql, and without the
 *      connection URL in a process list.
 * Spec: DATA-010
 * Invariants:
 *   - Exactly one argument, a key of `DATABASE_ROLE_SCRIPTS`; anything else prints the usage and exits 2, running
 *     nothing.
 *   - The connection is this run's `DATABASE_URL` (the administrator's for `roles`, the migration URL for the other
 *     two, as `prisma migrate deploy` reads it); it is never printed. `00-views-down.sql` and `02-grants.sql` refuse any
 *     user but the migrator.
 *   - A script is sent as one batch, which PostgreSQL runs in one transaction: it applies fully or not at all.
 *   - Prints one JSON line naming the script and the database user it ran as; a failure prints the database's
 *     message (credential shapes masked) and exits 1.
 * Collaborators: apps/server/prisma/roles/ (00-views-down.sql, 01-roles.sql, 02-grants.sql), ./prismaClient.ts,
 *   ../config/env.ts,
 *   ../logging/redactText.ts, docs/ops/database-roles.md.
 * Tests: apps/server/test/db/databaseRoles.int.test.ts, apps/server/test/db/databaseRolesDeploy.int.test.ts
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadEnvPart } from '../config/env.js';
import { redactText } from '../logging/redactText.js';
import { createPrismaClient, type Database } from './prismaClient.js';

/** The role scripts, by the step that runs them (D-109 and its amendments of 2026-11-04 and 2026-11-05). */
export const DATABASE_ROLE_SCRIPTS = {
  roles: '01-roles.sql',
  'views-down': '00-views-down.sql',
  grants: '02-grants.sql',
} as const;

/**
 * A step of the role set-up: `roles` creates the roles; `views-down` drops the analytics views before a migration;
 * `grants` gives the roles their privileges and builds the views again after it.
 */
export type DatabaseRoleStep = keyof typeof DATABASE_ROLE_SCRIPTS;

/** How the CLI is called. */
export const DATABASE_ROLES_USAGE =
  'usage: databaseRolesCli.ts roles        create the roles (database administrator, once per database)\n' +
  '       databaseRolesCli.ts views-down   drop the analytics views (hvli_migrator, right before every migration)\n' +
  '       databaseRolesCli.ts grants       grant privileges and build the analytics views (hvli_migrator, right ' +
  'after every migration)';

const ROLES_DIR = new URL('../../prisma/roles/', import.meta.url);

/**
 * Reads the CLI's arguments.
 * @param argv - The arguments after the script's path.
 * @returns The step, or undefined when the arguments are not exactly one step's name.
 */
export function databaseRoleStepOf(argv: readonly string[]): DatabaseRoleStep | undefined {
  const [step, ...rest] = argv;
  return rest.length === 0 && step !== undefined && Object.hasOwn(DATABASE_ROLE_SCRIPTS, step)
    ? (step as DatabaseRoleStep)
    : undefined;
}

/**
 * Reads a role script from apps/server/prisma/roles.
 * @param step - Which script.
 * @returns The SQL text.
 */
export function databaseRoleScript(step: DatabaseRoleStep): string {
  return readFileSync(new URL(DATABASE_ROLE_SCRIPTS[step], ROLES_DIR), 'utf8');
}

/**
 * Runs a role script as one batch, in one transaction.
 * @param db - A client connected as the user the step needs.
 * @param step - Which script.
 * @returns The database user the script ran as.
 * @throws The database's error when a statement fails; nothing of the script is then applied.
 */
export async function applyDatabaseRoleScript(
  db: Pick<Database, '$executeRawUnsafe' | '$queryRaw'>,
  step: DatabaseRoleStep,
): Promise<string> {
  // SECURITY: the text is the repository's own script, never input. WHY: without parameters it goes as one simple
  // query, which PostgreSQL runs as one implicit transaction, so a failing statement undoes the ones before it.
  await db.$executeRawUnsafe(databaseRoleScript(step));
  const [row] = await db.$queryRaw<{ user: string }[]>`SELECT current_user::text AS "user"`;
  return row?.user ?? '';
}

async function main(): Promise<void> {
  const step = databaseRoleStepOf(process.argv.slice(2));
  if (!step) {
    process.stderr.write(`${DATABASE_ROLES_USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    const { DATABASE_URL } = loadEnvPart(['DATABASE_URL']);
    const db = createPrismaClient(DATABASE_URL);
    try {
      const user = await applyDatabaseRoleScript(db, step);
      process.stdout.write(`${JSON.stringify({ applied: DATABASE_ROLE_SCRIPTS[step], as: user })}\n`);
    } finally {
      await db.$disconnect();
    }
  } catch (error) {
    // SECURITY: the environment's problems name variables, never values; a database error names users and objects,
    // and redactText masks a connection URL's password should one appear.
    process.stderr.write(`database roles failed: ${redactText((error as Error).message)}\n`);
    process.exitCode = 1;
  }
}

// WHY: tests import the functions without running the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
