/**
 * contentFileCleanup — deletes the files an author removed from an activity, as that author.
 *
 * Why: after a save, Lumi deletes files that are no longer referenced, but it asks the permission system with
 *      no user (ContentStorer.deleteUnusedOldFiles). Our permission system denies every unknown user (D-036), so
 *      without this the removed images and videos would stay in S3 for ever. We compare the file references
 *      before and after the save and delete the dropped ones with the acting author's rights.
 * Spec: H5P-004, H5P-006
 * Invariants:
 *   - Only files that were referenced before and are not referenced after are deleted; files Lumi just copied
 *     from temporary storage are referenced after the save and stay.
 *   - Deletion goes through Lumi's ContentManager, so the Edit permission is checked for the acting user.
 * Collaborators: ./HvlH5PEditor.ts, Lumi's ContentFileScanner and ContentManager.
 * Tests: apps/server/test/h5p/HvlH5PEditor.test.ts
 */
import {
  ContentFileScanner,
  type H5PEditor,
  type ILibraryName,
  type IUser,
  type LibraryManager,
} from '@lumieducation/h5p-server';

// WHY: Lumi does not export ContentManager from its index; the editor's field has the same type.
type ContentManager = H5PEditor['contentManager'];

/** Finds and deletes files that a save dropped. */
export class ContentFileCleanup {
  private readonly scanner: ContentFileScanner;

  /**
   * @param libraryManager - Lumi's library manager (semantics for the scan).
   * @param contentManager - Lumi's content manager (permission-checked deletes).
   */
  constructor(
    libraryManager: LibraryManager,
    private readonly contentManager: ContentManager,
  ) {
    this.scanner = new ContentFileScanner(libraryManager);
  }

  /**
   * The content files referenced by parameters (URLs and temporary files are not content files).
   * @param params - Content parameters.
   * @param mainLibrary - The content's main library.
   * @returns File paths relative to the content, e.g. `images/file-1a2b.png`.
   */
  async referencedFiles(params: unknown, mainLibrary: ILibraryName): Promise<string[]> {
    const refs = await this.scanner.scanForFiles(params, mainLibrary);
    return refs
      .map((ref) => ref.filePath)
      .filter((path) => !path.endsWith('#tmp') && !/^[a-z][a-z0-9+.-]*:/i.test(path));
  }

  /**
   * The files referenced by the stored version of an activity, read with the user's rights.
   * @param contentId - The activity.
   * @param mainLibrary - Its main library.
   * @param user - The acting author (account view).
   * @returns File paths, or an empty list when the activity has no stored parameters.
   */
  async storedFiles(contentId: string, mainLibrary: ILibraryName, user: IUser): Promise<string[]> {
    const params = await this.contentManager.getContentParameters(contentId, user);
    return this.referencedFiles(params, mainLibrary);
  }

  /**
   * Deletes the files that were referenced before a save and are not referenced after it.
   * @param contentId - The saved activity.
   * @param before - From `storedFiles` before the save.
   * @param after - From `referencedFiles` on the saved parameters.
   * @param user - The acting author (account view).
   */
  async deleteDropped(contentId: string, before: string[], after: string[], user: IUser): Promise<void> {
    const kept = new Set(after);
    for (const file of new Set(before)) {
      if (!kept.has(file)) await this.contentManager.deleteContentFile(contentId, file, user);
    }
  }
}
