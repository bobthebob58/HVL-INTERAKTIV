/**
 * pasteSourceGuard — refuses, before Lumi writes anything, a save whose file paths would copy files from an
 * activity the saver may not duplicate, or name a file the storage cannot hold.
 *
 * Why: Lumi copies the file behind every `../<id>/<file>` path in a saved activity (H5P's copy and paste, and our
 *      duplicator, D-092). Probe P2 showed what it does without help: it asks only for View, and when that is
 *      refused it still saves the activity with the path emptied; a `#tmp` paste path, or any path our storage
 *      refuses, fails the save with a 400 only after the activity row was written, leaving a half-saved draft. This
 *      guard runs in HvlH5PEditor's save after the sub-content policy and before Lumi, so a refused save writes
 *      nothing.
 * Spec: PROD-007, SEC-008, H5P-006
 * Invariants:
 *   - It finds file references with Lumi's own ContentFileScanner, so it sees exactly the paths Lumi will copy,
 *     nested sub-content included. It never changes the parameters.
 *   - A paste-source path (not `#tmp`) needs a UUID source and a storable file name, else 400; and the saver must be
 *     allowed to duplicate the source (`duplicateRules`), else 403. Unknown, invisible and non-duplicable sources
 *     get the same 403, so the answer reveals nothing. The duplicator's own paths pass by construction.
 *   - Every other local path, `#tmp` uploads included, must be a name `assertSafeObjectName` accepts (no `..` or
 *     `.` segment, no empty segment, no leading `/`, no backslash, no control character), else 400. The one
 *     exception is a web address whose scheme has capitals (`Https://…`, e.g. from a tablet keyboard): Lumi's scanner
 *     skips only a lower-case scheme, but H5P plays it as a web address and Lumi never stores it, so it is left to
 *     ./semantics/rightsOfUse.ts, as before. A `#tmp` path is always checked.
 * Collaborators: ./HvlH5PEditor.ts (calls `enforce`), ./pasteSourcePaths.ts, ./storage/s3Objects.ts,
 *   ./permissions/ContentAccessRepository.ts, ../learningDesign/collaboration/duplicateRules.ts,
 *   ../http/h5pErrorResponse.ts (translates both codes).
 * Tests: apps/server/test/h5p/pasteSourceGuard.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/duplicateFiles.int.test.ts
 */
import {
  ContentFileScanner,
  H5pError,
  type ContentParameters,
  type ILibraryName,
  type LibraryManager,
} from '@lumieducation/h5p-server';
import { mayDuplicate } from '../learningDesign/collaboration/duplicateRules.js';
import { isContentUuid } from './contentIds.js';
import { isHvlH5pUser } from './HvlH5pUser.js';
import type { ContentAccessRepository } from './permissions/ContentAccessRepository.js';
import { parsePasteSourcePath } from './pasteSourcePaths.js';
import { assertSafeObjectName } from './storage/s3Objects.js';

/** The machine code of a refused file path (400). */
export const UNSAFE_FILE_NAME = 'hvl:unsafe-file-name';
/** The machine code of a refused paste source (403). */
export const PASTE_SOURCE_NOT_ALLOWED = 'hvl:paste-source-not-allowed';

// UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/ContentFileScanner.ts
// (urlRegExp) has no `i` flag, while H5P.getPath in h5p.js tests the scheme with `i`. Keep in step on a Lumi upgrade.
const WEB_ADDRESS = /^https?:\/\//i;

const isStorableName = (name: string): boolean => {
  try {
    assertSafeObjectName(name);
    return true;
  } catch {
    return false;
  }
};

/** Checks the file paths of a save against the paste-source rules and the storage's name rules. */
export class PasteSourceGuard {
  private readonly scanner: ContentFileScanner;

  /**
   * @param libraryManager - The editor's library manager (semantics for the scan).
   * @param content - The activity facts the permission system also reads.
   */
  constructor(
    libraryManager: LibraryManager,
    private readonly content: ContentAccessRepository,
  ) {
    this.scanner = new ContentFileScanner(libraryManager);
  }

  /**
   * Refuses the save when a file path is unsafe or pastes from an activity the saver may not duplicate.
   * @param params - The parameters about to be saved (only read).
   * @param mainLibrary - Their main library.
   * @param user - The saver, as the editor received them.
   * @throws H5pError `hvl:unsafe-file-name` (400) or `hvl:paste-source-not-allowed` (403).
   * @spec PROD-007
   */
  async enforce(params: ContentParameters, mainLibrary: ILibraryName, user: unknown): Promise<void> {
    const sources = new Set<string>();
    for (const ref of await this.scanner.scanForFiles(params, mainLibrary)) {
      // WHY: Lumi copies a `#tmp` path from temporary storage, never from a paste source, whatever it looks like.
      const paste = ref.temporary ? undefined : parsePasteSourcePath(ref.filePath);
      // SECURITY: `..` in either part could reach another key prefix (Lumi's pattern allows it); refuse it here.
      const safe = paste
        ? isContentUuid(paste.sourceId) && isStorableName(paste.file)
        : isStorableName(ref.filePath) || (!ref.temporary && WEB_ADDRESS.test(ref.filePath));
      if (!safe) throw new H5pError(UNSAFE_FILE_NAME, {}, 400);
      if (paste) sources.add(paste.sourceId.toLowerCase());
    }
    for (const sourceId of sources) {
      // SECURITY: Lumi checks only View and empties what it may not read; copying needs the duplicate rule (D-092).
      const allowed = isHvlH5pUser(user) && mayDuplicate(user, await this.content.factsFor(sourceId));
      if (!allowed) throw new H5pError(PASTE_SOURCE_NOT_ALLOWED, {}, 403);
    }
  }
}
