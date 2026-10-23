/**
 * hubCheckCli — `npm run hub:check`: prints the Hub check report as JSON and exits 1 unless it passed.
 *
 * Why: spike step 3 (spec 01 §7) needs one command an operator runs where hub-api.h5p.org is reachable. It
 *      needs no database, Redis or S3, only the H5P settings, like the boot check.
 * Spec: H5P-001, H5P-003
 * Invariants: writes nothing; behind a proxy, run it with `NODE_USE_ENV_PROXY=1` so Node's fetch uses it.
 * Collaborators: ./hubCheck.ts, ./h5pServerInit.ts, ../config/env.ts.
 * Tests: apps/server/test/h5p/hubCheck.test.ts (the function it runs).
 */
import { loadEnvPart } from '../config/env.js';
import { createLogger } from '../logging/logger.js';
import { h5pServerInit } from './h5pServerInit.js';
import { runHubCheck } from './hubCheck.js';

try {
  const env = loadEnvPart(['H5P_CORE_DIR', 'H5P_EDITOR_DIR', 'H5P_LIBRARY_DIR', 'H5P_SITE_UUID']);
  const { config } = await h5pServerInit({ env, logger: createLogger({ level: 'warn' }) });
  const report = await runHubCheck(config);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  console.error(`✗ hub:check failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
