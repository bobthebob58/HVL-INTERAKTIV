/**
 * activityFileRoom — the storage's own hold on the limit for one activity's files: whether there is room for one
 * more file, and whether the activity is still within its bytes once the file is stored.
 *
 * Why: the editor's save checks an activity's files before Lumi writes (../activityFileBudget.ts), but files also
 *      reach the storage from a package import and from the duplicator's own copies. The storage is the one place
 *      every file passes, so it holds the limit too, and no path can go around it (D-139).
 * Spec: SEC-005
 * Invariants:
 *   - Before a file is stored: the activity holds fewer than the limit's files (a file that replaces one of the
 *     same name is not one more) and fewer than its bytes, else H5pError 413 `hvl:activity-files-over-limit`.
 *   - After a file is stored: `withinBytes` says whether the activity, the new file included, is within the bytes;
 *     the caller removes the file and refuses when it is not. A stream's size is known only once it is stored.
 *   - `storeFileWithinLimits` does both around the put, so a file past the limit is never left in the bucket.
 *   - One aggregate query over one activity's file rows per check; only the put and its undoing write.
 * Collaborators: ./PrismaContentStorage.ts (the caller), ./S3ContentFileStore.ts, ../activityFileBudget.ts (the
 *   limits and the refusal), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/activityFileLimits.int.test.ts
 */
import {
  ACTIVITY_FILE_LIMITS,
  activityFilesOverLimit,
  type ActivityFileLimits,
} from '../activityFileBudget.js';
import type { Readable } from 'node:stream';
import type { Database } from '../../infra/prismaClient.js';
import type { S3ContentFileStore } from './S3ContentFileStore.js';

/** The files of an activity other than the one about to be written: how many, and their bytes. */
async function otherFiles(
  db: Database,
  contentId: string,
  filename: string,
): Promise<{ count: number; bytes: number }> {
  const total = await db.h5PContentFile.aggregate({
    where: { contentId, filename: { not: filename } },
    _count: true,
    _sum: { size: true },
  });
  return { count: total._count, bytes: total._sum.size ?? 0 };
}

/**
 * Refuses a file when its activity has no room for one more.
 * @param db - Database client.
 * @param contentId - The activity, as stored.
 * @param filename - The file about to be stored.
 * @param limits - The limits; D-139's outside tests.
 * @throws H5pError 413 `hvl:activity-files-over-limit`.
 * @spec SEC-005
 */
export async function assertRoomForFile(
  db: Database,
  contentId: string,
  filename: string,
  limits: ActivityFileLimits = ACTIVITY_FILE_LIMITS,
): Promise<void> {
  const { count, bytes } = await otherFiles(db, contentId, filename);
  if (count >= limits.files || bytes >= limits.bytes) throw activityFilesOverLimit(limits);
}

/**
 * Tells whether an activity is within its bytes with a file of `size` stored under `filename`.
 * @param db - Database client.
 * @param contentId - The activity, as stored.
 * @param file - The stored file's name and size in bytes.
 * @param limits - The limits; D-139's outside tests.
 * @returns False when the activity's files, this one included, pass the limit's bytes.
 */
export async function withinBytes(
  db: Database,
  contentId: string,
  file: { readonly filename: string; readonly size: number },
  limits: ActivityFileLimits = ACTIVITY_FILE_LIMITS,
): Promise<boolean> {
  return (await otherFiles(db, contentId, file.filename)).bytes + file.size <= limits.bytes;
}

/** What the storage needs to store one file of an activity. */
export interface FileToStore {
  /** The activity, as stored. */
  readonly contentId: string;
  readonly filename: string;
  readonly stream: Readable;
}

/**
 * Stores one file of an activity, unless the activity has no room for it.
 * @param stores - The database and the S3 store for content files.
 * @param stores.db - Database client.
 * @param stores.files - S3 store for content files.
 * @param file - The activity, the file's name and its bytes.
 * @param limits - The limits; D-139's outside tests.
 * @returns The stored object's key, size and SHA-256.
 * @throws H5pError 413 `hvl:activity-files-over-limit`; a file that took the activity past its bytes is removed.
 * @spec SEC-005
 */
export async function storeFileWithinLimits(
  stores: { readonly db: Database; readonly files: Pick<S3ContentFileStore, 'put' | 'delete'> },
  file: FileToStore,
  limits: ActivityFileLimits = ACTIVITY_FILE_LIMITS,
): Promise<{ key: string; size: number; sha256: string }> {
  const { contentId, filename } = file;
  await assertRoomForFile(stores.db, contentId, filename, limits);
  const stored = await stores.files.put(contentId, filename, file.stream);
  if (await withinBytes(stores.db, contentId, { filename, size: stored.size }, limits)) return stored;
  // WHY: a stream's size is known only once it is stored; the object must not stay when the row is refused.
  await stores.files.delete(stored.key);
  throw activityFilesOverLimit(limits);
}
