/**
 * vitest.config — test settings for the web app (the `web` project of the root Vitest run).
 *
 * Why: the web app's own logic (translations, components) is tested without a server; pages that need Next.js's
 *      request context are tested in a browser through the server (apps/server/test/web). Component tests opt into
 *      jsdom per file with a `@vitest-environment jsdom` docblock; ./test/support/cleanup.ts unmounts what they render.
 * Spec: NFR-004
 * Tests: this file configures them; see apps/web/test/.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web',
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['test/support/cleanup.ts'],
  },
});
