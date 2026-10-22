/**
 * offlineContentTypeCache — keeps the editor from calling the H5P Hub while it serves requests.
 *
 * Why: with an empty content-type cache, Lumi contacts the Hub on every editor request and caches nothing when
 *      that fails (ContentTypeCache.get). Content types arrive only through reviewed seed packages (D-041), and
 *      the runtime must not depend on the Hub (R-04). Storing an empty list once makes Lumi build the editor's
 *      list from the installed libraries alone; `npm run hub:check` contacts the Hub explicitly.
 * Spec: H5P-011, H5P-002
 * Invariants:
 *   - An existing cache (for example one written by `hub:check`) is never replaced.
 * Collaborators: ./createH5pRuntime.ts, Lumi's ContentTypeCache (key `contentTypeCache`).
 * Tests: apps/server/test/h5p/HvlH5PEditor.test.ts
 */
import type { IKeyValueStorage } from '@lumieducation/h5p-server';

/** The key under which Lumi's ContentTypeCache keeps the Hub list. */
export const CONTENT_TYPE_CACHE_KEY = 'contentTypeCache';

/**
 * Stores an empty Hub list unless one is cached already.
 * @param storage - The editor's key-value storage (Redis in production).
 */
export async function keepContentTypeCacheOffline(storage: IKeyValueStorage): Promise<void> {
  if (!(await storage.load(CONTENT_TYPE_CACHE_KEY))) await storage.save(CONTENT_TYPE_CACHE_KEY, []);
}
