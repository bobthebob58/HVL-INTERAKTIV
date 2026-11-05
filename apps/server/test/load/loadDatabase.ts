/**
 * loadDatabase — the load bench's own PostgreSQL database: created and migrated with the server's real migrations
 * before the load, counted after it, and dropped at the end.
 *
 * Why: NFR-001's load writes thousands of xAPI and learner-state rows; D-114's load amendment of 2026-11-05 keeps
 *      them out of the shared development database, so a run leaves nothing behind and its counts are its own.
 * Spec: NFR-001
 * Invariants:
 *   - Runs only against a PostgreSQL server on this machine (`isLocalDatabaseServer`).
 *   - The name is unique per run (`hvli_load_…`); `drop` disconnects every client and drops it (WITH FORCE).
 *   - `storedRows` returns counts only, never a row.
 * Collaborators: ./loadBench.ts, ../support/roleDatabase.ts (`isLocalDatabaseServer`), apps/server/prisma.
 * Tests: tools/load/test/loadBench.test.mjs (through the bench)
 */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { isLocalDatabaseServer } from '../support/roleDatabase.js';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js');

/** The tables the load writes to, as Prisma names their models. */
export const LOAD_TABLES = ['xapiStatement', 'h5PUserData', 'ltiPlacement', 'identity', 'user'] as const;

/** A load database. */
export interface LoadDatabase {
  /** Its connection URL (the services' own role, on the new database). */
  readonly url: string;
  /** Counts the rows the load stored in each of `LOAD_TABLES`. */
  storedRows(): Promise<Record<(typeof LOAD_TABLES)[number], number>>;
  /** Drops the database. */
  drop(): Promise<void>;
}

/**
 * Creates and migrates a database for one load run.
 * @param baseUrl - `DATABASE_URL` of the local services.
 * @returns The database.
 * @throws Error before touching anything when the server is not on this machine.
 */
export async function createLoadDatabase(baseUrl: string): Promise<LoadDatabase> {
  if (!isLocalDatabaseServer(baseUrl))
    throw new Error('The load bench runs only against a local PostgreSQL.');
  const name = `hvli_load_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const server = createPrismaClient(baseUrl);
  await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  const counter = createPrismaClient(url.toString());
  const drop = async (): Promise<void> => {
    await counter.$disconnect();
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await server.$disconnect();
  };
  try {
    await promisify(execFile)(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: url.toString() },
    });
  } catch (error) {
    // WHY: a failed set-up must not leave a database behind on the shared server.
    await drop();
    throw error;
  }
  return {
    url: url.toString(),
    storedRows: async () => ({
      xapiStatement: await counter.xapiStatement.count(),
      h5PUserData: await counter.h5PUserData.count(),
      ltiPlacement: await counter.ltiPlacement.count(),
      identity: await counter.identity.count(),
      user: await counter.user.count(),
    }),
    drop,
  };
}
