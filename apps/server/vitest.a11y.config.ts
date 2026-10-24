/**
 * vitest.a11y.config — the automated accessibility suite (`npm run test:a11y`): axe and the browser checks of
 * UD-002 … UD-012 and DATA-011 on the built web app, the server's H5P pages and the ten real content types.
 *
 * Why: UD-030 makes this suite a CI gate of its own. It needs the built web app (`npm run build`, D-068), the real
 *      H5P packages (`npm run h5p:fetch-libraries`, D-078), the services and Chromium (D-079), and it is slower than
 *      the integration tests, so it runs separately from `npx vitest run`.
 * Spec: UD-030, NFR-004
 * Tests: this file configures them; see apps/server/a11y/.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// WHY: locally, apps/server/.env tells the tests where the docker compose services are (D-023).
const envFile = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    name: 'a11y',
    include: ['a11y/**/*.a11y.test.ts'],
    environment: 'node',
    // WHY: UD-030 lists lower-impact findings in the report; Vitest 5 shows a passing test's console output only
    // when `silent` is false.
    silent: false,
    // WHY: every file starts the whole server on the shared database and its own Chromium.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
