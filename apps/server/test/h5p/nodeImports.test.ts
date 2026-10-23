/**
 * Tests that the server's H5P modules load under plain Node, not only under Vitest.
 *
 * Why: Vitest smooths over CommonJS interop that Node's ESM loader refuses (a named import from
 *      cache-manager 4 passed every test but crashed `npm run seed:libraries`). The server and the CLIs run
 *      under Node, so the entry modules are imported once with tsx in a child process.
 * Spec: H5P-001, H5P-004
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { SERVER_ROOT } from '../../src/h5p/h5pServerInit.js';

const ENTRY_MODULES = [
  './src/h5p/createH5pRuntime.ts',
  './src/http/createH5pRouter.ts',
  './src/h5p/libraries/seedLibraries.ts',
];

describe('plain Node imports', () => {
  it('[H5P-004] the H5P runtime, router and seeder load under Node with tsx', () => {
    const script = ENTRY_MODULES.map((path) => `await import(${JSON.stringify(path)});`).join(' ');
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: SERVER_ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  }, 70_000);
});
