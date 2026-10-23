/**
 * vitest.config — runs every test project in the monorepo with one command (`npx vitest run`).
 *
 * Why: the session gate needs one test run that covers tools and apps. Test titles carry
 *      requirement IDs in brackets, which tools/spec-trace reads (DOC-004, DOC-006).
 * Spec: NFR-004
 * Collaborators: apps/server/vitest.config.ts (server unit and integration tests), apps/web/vitest.config.ts,
 *   packages/<name>/vitest.config.ts (one project per package).
 * Tests: this file is the test runner configuration itself.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'tools',
          include: ['tools/**/*.test.mjs'],
          environment: 'node',
          // WHY: the vendored marked build names a source map that is not vendored; Node loads it as it is,
          // so Vite never tries to read the map and prints no error stack on a fresh checkout.
          server: { deps: { external: [/tools\/spec-site\/vendor\//] } },
        },
      },
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
    ],
  },
});
