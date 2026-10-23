/**
 * cleanup — unmounts what a component test rendered and restores mocked globals after each test.
 *
 * Why: Testing Library cleans up by itself only when Vitest's globals are on, which this project does not use; a
 *      component left mounted would leak into the next test's queries. Node-environment tests have no document and
 *      skip the unmount.
 * Spec: NFR-004
 * Tests: used by every test in apps/web/test (vitest.config.ts `setupFiles`).
 */
import { afterEach, vi } from 'vitest';

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
