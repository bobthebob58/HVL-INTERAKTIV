/**
 * bootCheck — command-line check that the H5P engine would start: valid config, matching client files.
 *
 * Why: until the HTTP server exists (S2), CI and developers need a way to prove H5P-001 on a real checkout:
 *      the fetched core files are API 1.28 and the config points at hub-api.h5p.org.
 * Spec: H5P-001
 * Invariants: exits 1 with a readable message on any failure; prints one JSON log line on success.
 * Collaborators: ./h5pServerInit.ts, ../config/env.ts, ../logging/logger.ts.
 * Tests: apps/server/test/h5p/h5pServerInit.test.ts (the function it runs); CI runs this script.
 */
import { loadEnv } from '../config/env.js';
import { createLogger } from '../logging/logger.js';
import { h5pServerInit } from './h5pServerInit.js';

try {
  const env = loadEnv();
  await h5pServerInit({ env, logger: createLogger({ level: env.LOG_LEVEL }) });
} catch (error) {
  console.error(`✗ H5P boot check failed: ${(error as Error).message}`);
  process.exit(1);
}
