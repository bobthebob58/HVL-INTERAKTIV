/**
 * vitest.e2e.config — the end-to-end tests (`npm run test:e2e`): the whole server, the mock Canvas and mock Feide,
 * and full Chromium with third-party cookies blocked.
 *
 * Why: D-065 puts three browser flows in the S3 gate (cookie-less iframe launch → play → resume, the Deep Linking
 *      round trip, portal sharing with logout). They are slower than the integration tests and need full Chromium,
 *      so they run separately from `npx vitest run`.
 * Spec: NFR-004, LTI-003, LTI-005, PROD-006
 * Tests: this file configures them; see apps/server/e2e/.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// WHY: locally, apps/server/.env tells the tests where the docker compose services are (D-023).
const envFile = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    name: 'e2e',
    include: ['e2e/**/*.e2e.test.ts'],
    environment: 'node',
    // WHY: the flows share one database and each starts its own server and browser.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
