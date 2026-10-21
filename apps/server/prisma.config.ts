/**
 * prisma.config — tells the Prisma CLI where the schema, the migrations and the database are.
 *
 * Why: Prisma 7 reads the connection URL from this file instead of the schema, and the schema is split
 *      by domain into one folder, so the CLI must be pointed at both.
 * Spec: DATA-001
 * Invariants:
 *   - The URL comes from DATABASE_URL (apps/server/.env locally, the environment in CI); it is never
 *     written into a file in git.
 * Collaborators: prisma/schema/*.prisma, prisma/migrations/, src/infra/prismaClient.ts.
 * Tests: apps/server/test/db/schema.int.test.ts
 */
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// WHY: Prisma 7 no longer loads .env by itself; local development keeps its settings there.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
