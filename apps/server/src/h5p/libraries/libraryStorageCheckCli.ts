/**
 * libraryStorageCheckCli — `npm run libraries:check [-- <folder>]`: scans an installed library folder for a build
 * machine's secrets, without seeding.
 *
 * Why: a library storage seeded before the build fix keeps its leaky `H5P.AudioRecorder-1.0` through every re-seed
 *      (Lumi keeps an installed library of the same patch version; D-110 amendments of 2026-11-06). Operations check a
 *      storage with this command before an upgrade or after a restore, and delete what it names (runbook section 2).
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - Needs no database, Redis or S3: only the folder, `H5P_LIBRARY_DIR` (relative to apps/server) by default.
 *   - WHY: a relative folder after `--` is read from apps/server (`var/h5p/libraries`), as `seed:libraries` reads its
 *     folder (`var/h5p-real/packages`), wherever the command is typed; an absolute path is read as it is.
 *   - Exit code 0 when clean, 1 with one `✗` line per file that holds secrets; never prints a value.
 * Collaborators: ./installedLibraryScan.ts, ../../config/env.ts (`loadEnvPart`), ../h5pServerInit.ts (`SERVER_ROOT`).
 * Tests: apps/server/test/h5p/libraries/seedSecretScan.int.test.ts (runs the command),
 *   apps/server/test/h5p/libraries/librarySecretScans.test.ts (the function it runs).
 */
import { resolve } from 'node:path';
import { loadEnvPart } from '../../config/env.js';
import { SERVER_ROOT } from '../h5pServerInit.js';
import { assertInstalledLibrariesClean } from './installedLibraryScan.js';

try {
  const folder = resolve(SERVER_ROOT, process.argv[2] ?? loadEnvPart(['H5P_LIBRARY_DIR']).H5P_LIBRARY_DIR);
  const libraries = await assertInstalledLibrariesClean(folder);
  console.log(`✓ library storage: ${libraries} library folders, no build machine's secrets in them`);
} catch (error) {
  console.error(`✗ libraries:check failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
