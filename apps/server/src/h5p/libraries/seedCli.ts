/**
 * seedCli — `npm run seed:libraries [-- <folder>]`: installs the content types from the verified seed packages.
 *
 * Why: a fresh installation, a developer and CI need one offline command that brings the library folder to the
 *      reviewed set (H5P-003). It builds the same H5P runtime the server uses, so libraries are installed with
 *      the server's storage, locks and audit, and reports the counts and the time taken. Seeding keeps an
 *      installed library of the same patch version, so it then scans the whole library folder for a build
 *      machine's secrets (D-110 amendment of 2026-11-06).
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - Exits 1 with a readable message on any failure; nothing is installed after a folder, hash or secret error.
 *   - SECURITY: exits 1, naming each library folder to delete, when an installed library holds a build machine's
 *     secrets (names only, never a value).
 *   - Contacts no Hub; the folder defaults to docs/reference/h5p-core-1.28-seed-packages/.
 *   - Logs counts and duration only, never paths outside the repository or personal data.
 * Collaborators: ./seedLibraries.ts, ./LibraryInstaller.ts, ./installedLibraryScan.ts, ../createH5pRuntime.ts.
 * Tests: apps/server/test/h5p/libraries/seedSecretScan.int.test.ts (runs the command: secret findings, the
 *   installed-folder check), apps/server/test/h5p/libraries/seedLibraries.int.test.ts (the function it runs).
 */
import { resolve } from 'node:path';
import { loadEnv } from '../../config/env.js';
import { createPrismaClient } from '../../infra/prismaClient.js';
import { connectRedis } from '../../infra/redisClient.js';
import { createS3Client } from '../../infra/s3Client.js';
import { createLogger } from '../../logging/logger.js';
import { createH5pRuntime } from '../createH5pRuntime.js';
import { SERVER_ROOT } from '../h5pServerInit.js';
import { assertInstalledLibrariesClean } from './installedLibraryScan.js';
import { PrismaLibraryAuditSink } from './LibraryAuditSink.js';
import { LibraryInstaller } from './LibraryInstaller.js';
import { seedLibraries } from './seedLibraries.js';

const DEFAULT_FOLDER = resolve(SERVER_ROOT, '../../docs/reference/h5p-core-1.28-seed-packages');

try {
  const env = loadEnv(process.env);
  const logger = createLogger({ level: env.LOG_LEVEL });
  const db = createPrismaClient(env.DATABASE_URL);
  const redis = await connectRedis(env.REDIS_URL, logger);
  const s3 = createS3Client(env);
  try {
    const runtime = await createH5pRuntime({ env, logger, db, redis, s3 });
    const installer = new LibraryInstaller(
      runtime.editor.packageImporter,
      new PrismaLibraryAuditSink(db),
      runtime.editor.libraryManager,
    );
    const started = Date.now();
    const summary = await seedLibraries(resolve(process.argv[2] ?? DEFAULT_FOLDER), installer);
    const libraryFolders = await assertInstalledLibrariesClean(resolve(SERVER_ROOT, env.H5P_LIBRARY_DIR));
    logger.info({ ...summary, libraryFolders, durationMs: Date.now() - started }, 'seed libraries finished');
  } finally {
    await Promise.allSettled([redis.quit(), db.$disconnect()]);
    s3.destroy();
  }
} catch (error) {
  console.error(`✗ seed:libraries failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
