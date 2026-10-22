/**
 * S3TemporaryFileStorage — files an author uploads in the editor before saving the activity.
 *
 * Why: temporary files must be visible to every server node (the next request may hit another node) and
 *      must expire. S3 gives both; a bucket lifecycle rule is the backstop if the cleanup job stops (H5P-004).
 * Spec: H5P-004, SEC-005
 * Invariants:
 *   - Key: `<prefix><encoded user id>/<file name>`, so one author can never read another author's upload.
 *   - The expiry time is stored as object metadata; `listFiles` reads it (and the owner from the key) for the
 *     cleanup job. It skips files deleted while it lists and keys it did not write (no owner segment or a
 *     malformed escape); the bucket lifecycle rule removes those.
 *   - Uploads stop at `maxFileSize` bytes.
 * Collaborators: ./s3Objects.ts, ../../infra/s3Client.ts, ../jobs/TemporaryFileCleanupJob.ts (via H5PEditor).
 * Tests: apps/server/test/h5p/contentStorage.int.test.ts, apps/server/test/h5p/S3TemporaryFileStorage.test.ts
 */
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  H5pError,
  type IFileStats,
  type ITemporaryFile,
  type ITemporaryFileStorage,
  type IUser,
} from '@lumieducation/h5p-server';
import { assertSafeObjectName, isNotFound, limitedUpload, rangeHeader } from './s3Objects.js';

/** S3-backed `ITemporaryFileStorage`. */
export class S3TemporaryFileStorage implements ITemporaryFileStorage {
  /**
   * @param s3 - Client.
   * @param bucket - Bucket for temporary files (S3_TEMPORARY_BUCKET).
   * @param maxFileSize - Upload limit in bytes (SEC-005).
   * @param prefix - Key prefix inside the bucket.
   */
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly maxFileSize: number,
    private readonly prefix = 'tmp/',
  ) {}

  private key(userId: string, filename: string): string {
    return `${this.prefix}${encodeURIComponent(userId)}/${assertSafeObjectName(filename)}`;
  }

  /** Stores an upload with its owner and expiry. */
  async saveFile(
    filename: string,
    dataStream: Readable,
    user: IUser,
    expirationTime: Date,
  ): Promise<ITemporaryFile> {
    const Metadata = { owner: user.id, expiresat: expirationTime.toISOString() };
    await limitedUpload(
      this.s3,
      { Bucket: this.bucket, Key: this.key(user.id, filename), Metadata },
      dataStream,
      this.maxFileSize,
    );
    return { filename, ownedByUserId: user.id, expiresAt: expirationTime };
  }

  /** Deletes an upload; deleting a missing file is not an error. */
  async deleteFile(filename: string, ownerId: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(ownerId, filename) }));
  }

  /** True when the user has an upload with this name. */
  async fileExists(filename: string, user: IUser): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(user.id, filename) }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  /** Size and upload time of the user's file. */
  async getFileStats(filename: string, user: IUser): Promise<IFileStats> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(user.id, filename) }),
      );
      return { size: head.ContentLength ?? 0, birthtime: head.LastModified ?? new Date(0) };
    } catch (error) {
      throw isNotFound(error) ? notFound(filename) : error;
    }
  }

  /** Streams the user's file, optionally a byte range (inclusive). */
  async getFileStream(
    filename: string,
    user: IUser,
    rangeStart?: number,
    rangeEnd?: number,
  ): Promise<Readable> {
    try {
      const Range = rangeHeader(rangeStart, rangeEnd);
      const object = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.key(user.id, filename),
          ...(Range ? { Range } : {}),
        }),
      );
      return object.Body as Readable;
    } catch (error) {
      throw isNotFound(error) ? notFound(filename) : error;
    }
  }

  /** Lists uploads of one user, or of everyone (for the cleanup job). */
  async listFiles(user?: IUser): Promise<ITemporaryFile[]> {
    const prefix = user ? `${this.prefix}${encodeURIComponent(user.id)}/` : this.prefix;
    const files: ITemporaryFile[] = [];
    let ContinuationToken: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ...(ContinuationToken ? { ContinuationToken } : {}),
        }),
      );
      for (const object of page.Contents ?? []) {
        const parsed = this.parseKey(object.Key ?? '');
        // WHY: one object this adapter did not write must not make every cleanup tick fail.
        if (!parsed) continue;
        const head = await this.headIfPresent(object.Key ?? '');
        // WHY: an author's save (H5P's ContentStorer) can delete the file between LIST and HEAD.
        if (!head) continue;
        files.push({ ...parsed, expiresAt: new Date(head.Metadata?.expiresat ?? 0) });
      }
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return files;
  }

  /** Splits `<prefix><encoded user id>/<file name>`; the file name itself may contain "/". */
  private parseKey(key: string): { filename: string; ownedByUserId: string } | undefined {
    const rest = key.slice(this.prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 1 || slash === rest.length - 1) return undefined;
    try {
      return { filename: rest.slice(slash + 1), ownedByUserId: decodeURIComponent(rest.slice(0, slash)) };
    } catch {
      return undefined; // URIError: a malformed escape in a key written by something else
    }
  }

  private async headIfPresent(Key: string) {
    try {
      return await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key }));
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }
}

const notFound = (filename: string): H5pError =>
  new H5pError('storage-file-implementations:temporary-file-not-found', { filename }, 404);
