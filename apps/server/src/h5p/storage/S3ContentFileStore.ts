/**
 * S3ContentFileStore — reads and writes the media files of H5P activities in S3.
 *
 * Why: activity files (images, video, audio) can be large and are served to many learners; S3 keeps them
 *      out of PostgreSQL and available to every node. PrismaContentStorage keeps the file list in the database.
 * Spec: H5P-004, SEC-005
 * Invariants:
 *   - Key: `content/<contentId>/<file name>`; names are checked by `assertSafeObjectName`.
 *   - Writes stop at `maxFileSize` bytes and report size and SHA-256 of what was stored.
 * Collaborators: ./s3Objects.ts, ./PrismaContentStorage.ts.
 * Tests: apps/server/test/h5p/storage.int.test.ts
 */
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import { assertSafeObjectName, limitedUpload, rangeHeader } from './s3Objects.js';

/** File storage for activity content in one bucket. */
export class S3ContentFileStore {
  /**
   * @param s3 - Client.
   * @param bucket - Bucket for content files (S3_CONTENT_BUCKET).
   * @param maxFileSize - Upload limit in bytes (SEC-005).
   */
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly maxFileSize: number,
  ) {}

  /**
   * The object key of a content file.
   * @param contentId - Activity ID.
   * @param filename - File name inside the activity.
   * @returns `content/<contentId>/<filename>`.
   */
  key(contentId: string, filename: string): string {
    return `content/${assertSafeObjectName(contentId)}/${assertSafeObjectName(filename)}`;
  }

  /**
   * Stores a file.
   * @param contentId - Activity ID.
   * @param filename - File name inside the activity.
   * @param data - File contents.
   * @returns Key, size and SHA-256.
   */
  async put(
    contentId: string,
    filename: string,
    data: Readable,
  ): Promise<{ key: string; size: number; sha256: string }> {
    const key = this.key(contentId, filename);
    const { size, sha256 } = await limitedUpload(
      this.s3,
      { Bucket: this.bucket, Key: key },
      data,
      this.maxFileSize,
    );
    return { key, size, sha256 };
  }

  /**
   * Streams a file, or an inclusive byte range of it (video seeking).
   * @param key - Object key from the database.
   * @param rangeStart - First byte.
   * @param rangeEnd - Last byte.
   * @returns The object body.
   */
  async get(key: string, rangeStart?: number, rangeEnd?: number): Promise<Readable> {
    const Range = rangeHeader(rangeStart, rangeEnd);
    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ...(Range ? { Range } : {}) }),
    );
    return object.Body as Readable;
  }

  /**
   * Deletes one file.
   * @param key - Object key from the database.
   */
  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Deletes every file of an activity, including any the database does not know about.
   * @param contentId - Activity ID.
   */
  async deleteAll(contentId: string): Promise<void> {
    const Prefix = `content/${assertSafeObjectName(contentId)}/`;
    let ContinuationToken: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix,
          ...(ContinuationToken ? { ContinuationToken } : {}),
        }),
      );
      const Objects = (page.Contents ?? []).map((o) => ({ Key: o.Key }));
      if (Objects.length > 0)
        await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects } }));
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
  }
}
