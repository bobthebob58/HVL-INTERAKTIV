/**
 * offlineContentTypeCache — keeps the editor from calling the H5P Hub while it serves requests.
 *
 * Why: content types arrive only through reviewed seed packages (D-041), and the runtime must not depend on
 *      the Hub (R-04). Lumi, however, downloads the Hub's content-type list whenever its cache key is missing
 *      (ContentTypeCache.get → forceUpdate) and fetches Content Hub metadata on request even with the Content
 *      Hub switched off. So the editor's two Hub calls are replaced, and an empty list is stored once at start,
 *      so the editor builds its list from the installed libraries alone. `npm run hub:check` contacts the Hub
 *      explicitly when an operator wants it.
 * Spec: H5P-011, H5P-002
 * Invariants:
 *   - After `disconnectFromHub`, the editor's content-type cache and Content Hub never make a network request:
 *     a missing list is rebuilt as `[]`, and Content Hub metadata is empty lists (H5P's hub client always asks for
 *     them and fails with page errors on a refusal; found with the S4 editor page).
 *   - An existing cache is never replaced; nothing in the server writes one (`hub:check` only reports).
 * Collaborators: ./HvlH5PEditor.ts (calls `disconnectFromHub`), ./createH5pRuntime.ts, Lumi's ContentTypeCache
 *   and ContentHub (key `contentTypeCache`).
 * Tests: apps/server/test/h5p/offlineContentTypeCache.test.ts, apps/server/test/http/ajax.int.test.ts
 */
import type { H5PEditor, IKeyValueStorage } from '@lumieducation/h5p-server';

/** The Content Hub's filter lists, empty: HVL does not use the Content Hub. */
export const EMPTY_CONTENT_HUB_METADATA = Object.freeze({
  disciplines: [],
  languages: [],
  levels: [],
  licenses: [],
});

/** The key under which Lumi's ContentTypeCache keeps the Hub list. */
export const CONTENT_TYPE_CACHE_KEY = 'contentTypeCache';

/**
 * Stores an empty Hub list unless one is cached already.
 * @param storage - The editor's key-value storage (Redis in production).
 */
export async function keepContentTypeCacheOffline(storage: IKeyValueStorage): Promise<void> {
  if (!(await storage.load(CONTENT_TYPE_CACHE_KEY))) await storage.save(CONTENT_TYPE_CACHE_KEY, []);
}

/**
 * Replaces the editor's two Hub calls: the content-type list download returns an empty list (so Lumi stores
 * `[]` instead of asking the Hub), and Content Hub metadata is empty.
 * @param editor - The editor, right after construction.
 */
export function disconnectFromHub(editor: Pick<H5PEditor, 'contentTypeCache' | 'contentHub'>): void {
  // SECURITY: Lumi calls the Hub here even with fetching disabled in the config (D-041); no request may leave.
  editor.contentTypeCache.downloadContentTypesFromHub = async () => [];
  // WHY: a fresh copy each time, so no caller can change the shared empty lists.
  editor.contentHub.getMetadata = async () => structuredClone(EMPTY_CONTENT_HUB_METADATA);
}
