/**
 * vitest.config — test settings for the server workspace (the `server` project of the root Vitest run).
 *
 * Why: unit and integration tests share one runner, so `npm test` and CI run everything the S1 gate
 *      needs; integration tests (`*.int.test.ts`) read service locations from the environment (D-023).
 * Spec: NFR-004
 * Tests: this file configures them; see apps/server/test/.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// WHY: locally, apps/server/.env tells integration tests where the docker compose services are (D-023).
const envFile = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    name: 'server',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // WHY: integration tests share one PostgreSQL database, so test files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
