/**
 * s3Objects — small helpers shared by the S3 storage adapters: safe object names, ranges, size-limited uploads.
 *
 * Why: both S3 adapters turn H5P file names into object keys, read byte ranges for video seeking, and must
 *      never store more than the configured limit, even when a client lies about the size (SEC-005).
 * Spec: H5P-004, SEC-005
 * Invariants:
 *   - A file name is relative, uses `/` only, and has no empty, `.` or `..` segment and no control characters.
 *   - `limitedUpload` aborts the upload as soon as more than `maxBytes` have streamed through, and destroys
 *     the source stream on any failure.
 * Collaborators: ./S3ContentFileStore.ts, ./S3TemporaryFileStorage.ts.
 * Tests: apps/server/test/h5p/contentStorage.int.test.ts, apps/server/test/h5p/s3Objects.test.ts
 */
import { createHash } from 'node:crypto';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

/**
 * Rejects file names that could escape their key prefix or confuse tools that later mirror the bucket.
 * @param name - File name as given by H5P, e.g. `images/photo-1a2b.png`.
 * @returns The same name, when it is safe.
 * @throws Error naming the problem.
 */
export function assertSafeObjectName(name: string): string {
  // SECURITY: S3 itself has no directories, but backups and sync tools that write keys to disk do.
  const hasControlCharacter = [...name].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);
  if (name === '' || name.startsWith('/') || name.includes('\\') || hasControlCharacter) {
    throw new Error(`unsafe file name: ${JSON.stringify(name)}`);
  }
  if (name.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`unsafe file name: ${JSON.stringify(name)}`);
  }
  return name;
}

/**
 * Builds an HTTP Range header value for an inclusive byte range.
 * @param start - First byte, if a range was requested.
 * @param end - Last byte (inclusive), if given.
 * @returns e.g. `bytes=0-99`, or undefined for the whole object.
 */
export function rangeHeader(start?: number, end?: number): string | undefined {
  if (start === undefined) return undefined;
  return `bytes=${start}-${end ?? ''}`;
}

/**
 * Tells whether an S3 SDK error means "no such object".
 * @param error - Anything thrown by the SDK.
 * @returns True for NotFound / NoSuchKey / HTTP 404.
 */
export function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

/** Thrown when an upload streams more bytes than allowed. */
export class FileTooLargeError extends Error {
  /**
   * @param maxBytes - The limit that was exceeded.
   */
  constructor(readonly maxBytes: number) {
    super(`file is larger than ${maxBytes} bytes`);
    this.name = 'FileTooLargeError';
  }
}

/**
 * Streams a body to S3 while counting and hashing it, and aborts above `maxBytes`.
 * @param s3 - Client.
 * @param params - Bucket, key and optional user metadata.
 * @param body - Data to upload.
 * @param maxBytes - Hard upper limit for this object.
 * @returns Size in bytes and SHA-256 (hex) of what was stored.
 * @throws FileTooLargeError when the limit is exceeded (nothing is left in the bucket).
 */
export async function limitedUpload(
  s3: S3Client,
  params: { Bucket: string; Key: string; Metadata?: Record<string, string> },
  body: Readable,
  maxBytes: number,
): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256');
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      size += chunk.length;
      if (size > maxBytes) return done(new FileTooLargeError(maxBytes));
      hash.update(chunk);
      done(null, chunk);
    },
  });
  const sink = new PassThrough();
  // WHY: pipeline destroys every stream on error, so a rejected upload releases the file or socket it read from.
  const piping = pipeline(body, meter, sink);
  // WHY: lib-storage Upload streams in parts, so a 50 MB video never sits in memory as a whole.
  const upload = new Upload({ client: s3, params: { ...params, Body: sink } }).done();
  // WHY: if S3 fails first, nobody reads the sink any more; destroying it ends the pipeline instead of stalling.
  upload.catch((error: unknown) => sink.destroy(error as Error));
  const [piped, uploaded] = await Promise.allSettled([piping, upload]);
  if (piped.status === 'rejected') throw piped.reason;
  if (uploaded.status === 'rejected') throw uploaded.reason;
  return { size, sha256: hash.digest('hex') };
}
