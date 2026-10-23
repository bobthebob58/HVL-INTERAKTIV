/**
 * Unit test for the library storage cache lifetime.
 *
 * Spec: H5P-004
 */
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { caching as Caching } from 'cache-manager';
import {
  createLibraryStorage,
  LIBRARY_CACHE_TTL_SECONDS,
} from '../../src/h5p/storage/libraryStorageFactory.js';

const caching = vi.fn((options: unknown) => ({
  options,
  wrap: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

describe('[H5P-004] library storage', () => {
  it('[H5P-004] caches library metadata per node for at most LIBRARY_CACHE_TTL_SECONDS', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'h5p-libs-'));
    try {
      const storage = createLibraryStorage(join(dir, 'libraries'), caching as unknown as typeof Caching);
      expect(LIBRARY_CACHE_TTL_SECONDS).toBe(300);
      expect(caching).toHaveBeenCalledTimes(1);
      expect(caching).toHaveBeenCalledWith(
        expect.objectContaining({ store: 'memory', ttl: LIBRARY_CACHE_TTL_SECONDS }),
      );
      // WHY: without our cache, CachedLibraryStorage silently builds its own with a 24-hour lifetime (D-026).
      expect((storage as unknown as { cache: unknown }).cache).toBe(caching.mock.results[0]?.value);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('[H5P-004] by default the cache is cache-manager’s in-memory store, loaded the way Node can load it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'h5p-libs-'));
    try {
      const storage = createLibraryStorage(join(dir, 'libraries'));
      const cache = (storage as unknown as { cache: { store: { name: string } } }).cache;
      expect(cache.store.name).toBe('memory');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
