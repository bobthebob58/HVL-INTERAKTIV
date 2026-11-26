/**
 * activityFileBudget — the limit for the files of one activity, and the check of a save against it before Lumi
 * writes anything.
 *
 * Why: a package that is imported may unpack to 200 MB at most (SEC-005), and a person may start a bounded number
 *      of copies and uploads (D-092, D-120). But nothing bounded what one activity holds, so one save or one copy
 *      whose file paths name very many large files could make the server write an unbounded amount to storage in
 *      a single request. One activity now holds at most as much as one package may bring, so every activity can
 *      still be exported and imported again, and one copy writes a bounded amount (D-139).
 * Spec: SEC-005, PROD-007
 * Invariants:
 *   - At most `ACTIVITY_FILE_LIMITS.files` files and `ACTIVITY_FILE_LIMITS.bytes` bytes in one activity.
 *   - The check reads the file references with Lumi's own ContentFileScanner, as ./pasteSourceGuard.ts does, so it
 *     counts exactly the files the saved activity would hold: uploads in temporary storage, files pasted from
 *     another activity, and files the activity keeps. A web address is no file. A reference counts once.
 *   - Sizes are read through Lumi's managers with the saver's rights; a file that cannot be read weighs nothing,
 *     since Lumi will not copy it either. The sum stops at the first byte past the limit.
 *   - Past a limit: H5pError 413 `hvl:activity-files-over-limit`, before anything is written.
 *   - The storage holds the same limit for every file it is given (./storage/activityFileRoom.ts).
 * Collaborators: ./editorSaveSteps.ts (calls `enforce`), ./pasteSourcePaths.ts, ./H5pConfigFactory.ts
 *   (`MAX_TOTAL_SIZE`), ./storage/activityFileRoom.ts, ../http/h5pErrorResponse.ts (the message).
 * Tests: apps/server/test/h5p/activityFileBudget.test.ts, apps/server/test/h5p/activityFileLimits.int.test.ts
 */
import {
  ContentFileScanner,
  H5pError,
  type ContentParameters,
  type H5PEditor,
  type ILibraryName,
  type IUser,
  type LibraryManager,
} from '@lumieducation/h5p-server';
import { MAX_TOTAL_SIZE } from './H5pConfigFactory.js';
import { parsePasteSourcePath } from './pasteSourcePaths.js';

/** How many files and bytes one activity may hold. */
export interface ActivityFileLimits {
  readonly files: number;
  readonly bytes: number;
}

/** D-139's limits: 1 000 files (real activities hold tens) and what one imported package may unpack to. */
export const ACTIVITY_FILE_LIMITS: ActivityFileLimits = Object.freeze({ files: 1000, bytes: MAX_TOTAL_SIZE });

/** The machine code of a save, copy or file refused by the limit (413). */
export const ACTIVITY_FILES_OVER_LIMIT = 'hvl:activity-files-over-limit';

const MB = 1024 * 1024;
const WEB_ADDRESS = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The refusal for an activity past its file limit.
 * @param limits - The limits in force.
 * @returns An H5pError with status 413 and the limits for the message.
 */
export const activityFilesOverLimit = (limits: ActivityFileLimits = ACTIVITY_FILE_LIMITS): H5pError =>
  new H5pError(
    ACTIVITY_FILES_OVER_LIMIT,
    { maxFiles: String(limits.files), maxMb: String(Math.floor(limits.bytes / MB)) },
    413,
  );

/** One file reference of a save, as Lumi's scanner reports it. */
export interface ScannedFile {
  readonly filePath: string;
  readonly temporary: boolean;
}

/** Lumi's managers the sizes are read through; both check the saver's rights. */
export interface FileSizeReaders {
  readonly contentManager: Pick<H5PEditor['contentManager'], 'getContentFileStats'>;
  readonly temporaryFileManager: Pick<H5PEditor['temporaryFileManager'], 'getFileStats'>;
}

/** Checks a save's files against the limit for one activity. */
export class ActivityFileBudget {
  /**
   * @param scan - Lists the file references of parameters (Lumi's scanner outside tests).
   * @param readers - Where the sizes come from.
   * @param limits - The limits; D-139's outside tests.
   */
  constructor(
    private readonly scan: (params: ContentParameters, main: ILibraryName) => Promise<readonly ScannedFile[]>,
    private readonly readers: FileSizeReaders,
    private readonly limits: ActivityFileLimits = ACTIVITY_FILE_LIMITS,
  ) {}

  /**
   * The budget on Lumi's own scanner.
   * @param libraryManager - The editor's library manager (semantics for the scan).
   * @param readers - Where the sizes come from.
   * @param limits - The limits; D-139's outside tests.
   * @returns The budget.
   */
  static onScanner(
    libraryManager: LibraryManager,
    readers: FileSizeReaders,
    limits?: ActivityFileLimits,
  ): ActivityFileBudget {
    const scanner = new ContentFileScanner(libraryManager);
    return new ActivityFileBudget((params, main) => scanner.scanForFiles(params, main), readers, limits);
  }

  /**
   * Refuses a save whose activity would hold more files or bytes than one activity may.
   * @param contentId - The saved activity, or undefined for a new one.
   * @param params - The parameters about to be saved (only read).
   * @param mainLibrary - Their main library.
   * @param user - The saver, as the editor received them.
   * @throws H5pError 413 `hvl:activity-files-over-limit`.
   * @spec SEC-005
   */
  async enforce(
    contentId: string | undefined,
    params: ContentParameters,
    mainLibrary: ILibraryName,
    user: IUser,
  ): Promise<void> {
    const sizes = new Map<string, () => Promise<{ size: number }>>();
    const { contentManager, temporaryFileManager } = this.readers;
    for (const ref of await this.scan(params, mainLibrary)) {
      const path = ref.filePath.replace(/#tmp$/, '');
      if (ref.temporary) {
        sizes.set(`#tmp/${path}`, () => temporaryFileManager.getFileStats(path, user));
        continue;
      }
      if (WEB_ADDRESS.test(path)) continue;
      const paste = parsePasteSourcePath(path);
      const [owner, file] = paste ? [paste.sourceId.toLowerCase(), paste.file] : [contentId, path];
      // WHY: a new activity has no stored file of its own yet, so such a reference names nothing Lumi keeps.
      if (owner !== undefined)
        sizes.set(`${owner}/${file}`, () => contentManager.getContentFileStats(owner, file, user));
    }
    if (sizes.size > this.limits.files) throw activityFilesOverLimit(this.limits);
    let bytes = 0;
    for (const read of sizes.values()) {
      // WHY: a file that is missing, or not the saver's to read, is not copied by Lumi either: it weighs nothing.
      bytes += await read().then(
        (stats) => stats.size,
        () => 0,
      );
      if (bytes > this.limits.bytes) throw activityFilesOverLimit(this.limits);
    }
  }
}
