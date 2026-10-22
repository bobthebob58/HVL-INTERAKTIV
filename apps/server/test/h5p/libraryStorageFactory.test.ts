/**
 * Unit test for the library storage cache lifetime.
 *
 * Spec: H5P-004
 */
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const caching = vi.fn((options: unknown) => ({
  options,
  wrap: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock('cache-manager', () => ({ caching }));

describe('[H5P-004] library storage', () => {
  it('[H5P-004] caches library metadata per node for at most LIBRARY_CACHE_TTL_SECONDS', async () => {
    const { createLibraryStorage, LIBRARY_CACHE_TTL_SECONDS } =
      await import('../../src/h5p/storage/libraryStorageFactory.js');
    const dir = mkdtempSync(join(tmpdir(), 'h5p-libs-'));
    try {
      createLibraryStorage(join(dir, 'libraries'));
      expect(LIBRARY_CACHE_TTL_SECONDS).toBe(300);
      expect(caching).toHaveBeenCalledWith(
        expect.objectContaining({ store: 'memory', ttl: LIBRARY_CACHE_TTL_SECONDS }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
