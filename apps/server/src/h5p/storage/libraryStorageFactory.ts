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
 * Tests: apps/server/test/h5p/storage.int.test.ts
 */
import { mkdirSync } from 'node:fs';
import { cacheImplementations, fsImplementations, type ILibraryStorage } from '@lumieducation/h5p-server';
import { caching } from 'cache-manager';

/** How long library metadata stays in a node's memory, in seconds. */
export const LIBRARY_CACHE_TTL_SECONDS = 300;

/**
 * Creates the library storage.
 * @param libraryDir - Absolute folder on the shared volume (H5P_LIBRARY_DIR); created if missing.
 * @returns A cached library storage.
 */
export function createLibraryStorage(libraryDir: string): ILibraryStorage {
  mkdirSync(libraryDir, { recursive: true });
  const cache = caching({ store: 'memory', ttl: LIBRARY_CACHE_TTL_SECONDS, max: 10_000 });
  return new cacheImplementations.CachedLibraryStorage(
    new fsImplementations.FileLibraryStorage(libraryDir),
    cache,
  );
}
