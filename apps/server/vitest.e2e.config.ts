/**
 * vitest.e2e.config — the end-to-end tests (`npm run test:e2e`): the whole server, the mock Canvas and mock Feide,
 * and full Chromium with third-party cookies blocked.
 *
 * Why: D-065 puts three browser flows in the S3 gate (cookie-less iframe launch → play → resume, the Deep Linking
 *      round trip, portal sharing with logout). S4 adds the H5P editor in the cookie-less Canvas iframe, and two
 *      flows on the built web app with the real content types: publishing despite a validator error with a reason
 *      (Feide login, Sjekk og publiser, the publish dialog) and the Canvas page `/app/play` with Spel and Rediger
 *      where frame storage is blocked. S5 adds four on the built web app: J1's portal part (pattern → publish), a
 *      colleague's copy from the content bank, the mappe downloads and a confirmed reset of saved progress. They
 *      are slower than the integration tests and need full Chromium, so they run separately from
 *      `npx vitest run`; the web app flows also need `npm run build` and
 *      `npm run h5p:fetch-libraries` (skipped without them locally, failing in CI). A failed step names itself, what
 *      failed before it (with every ltik redacted) and whether the flow's rows are still in the database
 *      (test/support/flowRecorder.ts, test/support/lostTestRows.ts). A test bed that closes in another process on
 *      the same database removes only its own mock Canvas's users and its own mock Feide's accounts, with their
 *      content; the flows on the built web app have a run author of their own, while the other flows' demo Feide
 *      users are the same in every process, so run the suite without other test runs or servers on that database.
 * Spec: NFR-004, LTI-003, LTI-005, LTI-006, PROD-003, PROD-006, UD-022, DATA-009, PROD-001, PROD-007, PROD-013,
 *   MAPPE-001
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
