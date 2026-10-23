/**
 * libraryStorageFactory — where installed H5P libraries live: a shared folder, with a short in-memory cache.
 *
 * Why: libraries are read on every page view and change only when an admin installs or updates a content
 *      type. A shared volume plus Lumi's CachedLibraryStorage is the simplest correct setup (D-026).
 * Spec: H5P-004
 * Invariants:
 *   - The cache lives at most `LIBRARY_CACHE_TTL_SECONDS`, so a library update on one node reaches the others
 *     within that time (Lumi's own default is 24 hours, too long for several nodes).
 * Collaborators: @lumieducation/h5p-server (FileLibraryStorage, CachedLibraryStorage), ../h5pServerInit.ts.
 * Tests: apps/server/test/h5p/sharedState.int.test.ts, apps/server/test/h5p/libraryStorageFactory.test.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cacheImplementations, fsImplementations, type ILibraryStorage } from '@lumieducation/h5p-server';
import type { caching as Caching } from 'cache-manager';

// WHY: cache-manager 4 is CommonJS whose exports Node's ESM loader cannot detect, so `import { caching }`
// works under Vitest but fails when the server or a CLI runs under Node.
const { caching } = createRequire(import.meta.url)('cache-manager') as { caching: typeof Caching };

/** How long library metadata stays in a node's memory, in seconds. */
export const LIBRARY_CACHE_TTL_SECONDS = 300;

/**
 * Creates the library storage.
 * @param libraryDir - Absolute folder on the shared volume (H5P_LIBRARY_DIR); created if missing.
 * @param createCache - cache-manager's `caching`; tests pass a spy to see the options.
 * @returns A cached library storage.
 */
export function createLibraryStorage(
  libraryDir: string,
  createCache: typeof Caching = caching,
): ILibraryStorage {
  mkdirSync(libraryDir, { recursive: true });
  const cache = createCache({ store: 'memory', ttl: LIBRARY_CACHE_TTL_SECONDS, max: 10_000 });
  return new cacheImplementations.CachedLibraryStorage(
    new fsImplementations.FileLibraryStorage(libraryDir),
    cache,
  );
}
