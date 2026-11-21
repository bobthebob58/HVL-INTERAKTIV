/**
 * storedContent — an activity's stored row, in the shape of the editor's `getContent`, for tests that assert what
 * is stored.
 *
 * Why: `HvlH5PEditor.getContent` answers with what H5P's editor form is handed: fitted, cleaned, with quotes in the
 *      editor's own form (D-124). A test about what a save or an import stored must read the row itself.
 * Spec: H5P-006
 * Invariants: reads through the editor's content storage, so the answer is the `metadata` and `params` columns as
 *   they are; nothing is cleaned or changed.
 * Tests: shared by apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts and
 *   apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts.
 */
import type { ContentParameters, H5PEditor, IContentMetadata, IUser } from '@lumieducation/h5p-server';

/** A stored activity: its h5p.json, main library and parameters, as `getContent` shapes them. */
export interface StoredContent {
  readonly h5p: IContentMetadata;
  /** The main library as `H5P.Name x.y`. */
  readonly library: string;
  readonly params: { readonly params: ContentParameters; readonly metadata: IContentMetadata };
}

/**
 * Reads an activity's stored row.
 * @param editor - The editor whose storage holds the activity.
 * @param contentId - The activity.
 * @param user - Who reads (the storage does not check it; the tests' author).
 * @returns The stored metadata and parameters.
 */
export async function storedContent(
  editor: H5PEditor,
  contentId: string,
  user: IUser,
): Promise<StoredContent> {
  const [h5p, params] = await Promise.all([
    editor.contentStorage.getMetadata(contentId, user),
    editor.contentStorage.getParameters(contentId, user),
  ]);
  const main = h5p.preloadedDependencies.find(({ machineName }) => machineName === h5p.mainLibrary);
  const library = `${h5p.mainLibrary} ${String(main?.majorVersion ?? 0)}.${String(main?.minorVersion ?? 0)}`;
  return { h5p, library, params: { params: params as ContentParameters, metadata: h5p } };
}
