/**
 * vitest.config — the `hvl-h5p-theme` test project: the prefix generator, the theme's structure and the prefix
 * script in a simulated document.
 *
 * Why: the root Vitest run picks up every packages/<name>/vitest.config.ts, so these tests run with the gate; the
 *      real rendering inside H5P is proven by apps/server/test/h5p/hvlTheme.browser.int.test.ts.
 * Spec: UD-003, UD-011
 * Tests: packages/hvl-h5p-theme/test/
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'hvl-h5p-theme',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
