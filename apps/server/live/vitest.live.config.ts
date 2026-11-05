/**
 * vitest.live.config — the live-contract seam's own test run: the checks of what the mock Canvas and mock Feide
 * assume, against ALU's test Canvas, real Feide or the mocks, and the tests of its configuration.
 *
 * Why: D-101 (amended 2026-11-05) hands the confirmation against real Canvas and Feide to HVL's bachelor students.
 *      The checks must never run by accident, so they stay outside the root Vitest projects (`npx vitest run` and the
 *      gate's per-ID runs never select them) and run only through this file, and inside it only when the
 *      `LIVE_*` variables ask for it (./liveConfig.ts).
 * Spec: LTI-008, LTI-012, AUTH-001
 * Invariants:
 *   - `live/.env` (git-ignored) is read first, then `apps/server/.env` for a mock run's local services; a variable
 *     already set in the shell wins over both.
 *   - Files run one at a time: a mock run starts the whole app on the shared local database, and a Canvas run should
 *     not send the test instance parallel requests.
 * Collaborators: ./liveConfig.ts, ./README.md.
 * Tests: this file configures them; see apps/server/live/.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

for (const file of ['.env', '../.env']) {
  const path = fileURLToPath(new URL(file, import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'live',
    include: ['live/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
