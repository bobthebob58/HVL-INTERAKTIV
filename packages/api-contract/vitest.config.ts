/**
 * vitest.config — test settings for the API contract (the `api-contract` project of the root Vitest run).
 *
 * Why: the schemas and the OpenAPI builder are pure, so their tests need no server or browser; the server's own
 *      tests check that the routes it mounts match the registry (apps/server/test/http/api/).
 * Spec: DOC-012
 * Tests: this file configures them; see packages/api-contract/test/.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-contract',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
