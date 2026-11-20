/**
 * staleUploadFolders — removes upload folders that an earlier run of the server left behind.
 *
 * Why: every upload gets a folder of its own in the system's temporary folder and removes it when its request
 *      ends (./multipartUpload.ts; ../security/svg/SvgCleaner.ts for the copy Lumi's sanitiser reads). A process that
 *      is stopped in the middle of a request cannot remove its folder, and the files would then take up the
 *      temporary area until the machine restarts (SEC-005, D-118).
 * Spec: SEC-005
 * Invariants:
 *   - Only folders whose names start with one of our own prefixes are removed, and only when they were last
 *     changed more than `olderThanMs` ago (an hour by default): no running request's folder is that old, also
 *     when several server processes share the temporary folder.
 *   - Best effort: a folder that cannot be read or removed is skipped, never an error, so the start goes on.
 * Collaborators: ./multipartUpload.ts and ../security/svg/SvgCleaner.ts (the prefixes), ../server/main.ts (calls it
 *   once at start).
 * Tests: apps/server/test/http/staleUploadFolders.test.ts
 */
import { readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SVG_COPY_FOLDER_PREFIX } from '../security/svg/SvgCleaner.js';
import { UPLOAD_FOLDER_PREFIX } from './multipartUpload.js';

/** The name prefixes of the folders this server makes in the temporary folder. */
export const OWN_FOLDER_PREFIXES: readonly string[] = [UPLOAD_FOLDER_PREFIX, SVG_COPY_FOLDER_PREFIX];

/** An hour: far longer than any request may take. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

/** Where and when the sweep looks; every field has the production default. */
export interface StaleFolderOptions {
  /** The temporary folder; `os.tmpdir()` by default. */
  readonly dir?: string;
  /** Minimum age in milliseconds; `STALE_AFTER_MS` by default. */
  readonly olderThanMs?: number;
  /** The current time in milliseconds; `Date.now()` by default. */
  readonly now?: number;
}

/**
 * Removes this server's own upload folders that are older than the limit.
 * @param options - Folder, age limit and clock; the production defaults when omitted.
 * @returns How many folders were removed.
 * @example
 * logger.info({ removed: await removeStaleUploadFolders() }, 'stale upload folders removed');
 */
export async function removeStaleUploadFolders(options: StaleFolderOptions = {}): Promise<number> {
  const dir = options.dir ?? tmpdir();
  const before = (options.now ?? Date.now()) - (options.olderThanMs ?? STALE_AFTER_MS);
  const names = await readdir(dir).catch(() => [] as string[]);
  let removed = 0;
  for (const name of names) {
    if (!OWN_FOLDER_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    const path = join(dir, name);
    const info = await stat(path).catch(() => undefined);
    if (!info?.isDirectory() || info.mtimeMs > before) continue;
    const gone = await rm(path, { recursive: true, force: true }).then(
      () => true,
      () => false,
    );
    if (gone) removed += 1;
  }
  return removed;
}
