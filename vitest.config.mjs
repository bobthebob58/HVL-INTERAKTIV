/**
 * vitest.config — runs every test project in the monorepo with one command (`npx vitest run`).
 *
 * Why: the session gate needs one test run that covers tools and apps. Test titles carry
 *      requirement IDs in brackets, which tools/spec-trace reads (DOC-004, DOC-006).
 * Spec: NFR-004
 * Collaborators: apps/server/vitest.config.ts (server unit and integration tests).
 * Tests: this file is the test runner configuration itself.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'tools', include: ['tools/**/*.test.mjs'], environment: 'node' } },
      'apps/*/vitest.config.ts',
    ],
  },
});
