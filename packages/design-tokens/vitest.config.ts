/**
 * vitest.config — the `design-tokens` test project: contrast, generator and lint-rule tests.
 *
 * Why: the root Vitest run picks up every packages/<name>/vitest.config.ts, so `npx vitest run` covers UD-001's
 *      contrast test and the colour lint proofs with the rest of the gate.
 * Spec: UD-001
 * Tests: packages/design-tokens/test/
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'design-tokens',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // WHY: the lint tests load ESLint's and Stylelint's full configurations once each, which takes a few seconds.
    testTimeout: 60_000,
  },
});
