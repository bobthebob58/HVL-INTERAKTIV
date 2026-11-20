/**
 * Unit tests for the S3 helper functions: safe object names, byte ranges, size-limited uploads, and that a
 * store closes the data it was handed when it refuses the name.
 *
 * Spec: SEC-005, H5P-004
 */
import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import type { IUser } from '@lumieducation/h5p-server';
import { S3ContentFileStore } from '../../src/h5p/storage/S3ContentFileStore.js';
import {
  assertSafeObjectName,
  FileTooLargeError,
  isNotFound,
  keyForUpload,
  limitedUpload,
  rangeHeader,
} from '../../src/h5p/storage/s3Objects.js';
import { S3TemporaryFileStorage } from '../../src/h5p/storage/S3TemporaryFileStorage.js';

/** A body of `megabytes` MB in 64 KB chunks, produced lazily; above 4 parts × 5 MB it is still streaming when S3 fails. */
const lazyBody = (megabytes: number): Readable =>
  Readable.from(
    (function* () {
      for (let i = 0; i < megabytes * 16; i += 1) yield Buffer.alloc(65_536);
    })(),
  );

describe('[SEC-005] object names', () => {
  it('[SEC-005] accepts H5P file names with folders', () => {
    expect(assertSafeObjectName('images/photo-1a2b.png')).toBe('images/photo-1a2b.png');
    expect(assertSafeObjectName('video.mp4')).toBe('video.mp4');
  });

  it('[SEC-005] rejects traversal, absolute, empty-segment, backslash and control-character names', () => {
    for (const name of ['../x.png', 'a/../../x', '/etc/passwd', 'a//b', './a', 'a\\b', 'a\nb', '']) {
      expect(() => assertSafeObjectName(name), JSON.stringify(name)).toThrow('unsafe file name');
    }
  });
});

describe('[SEC-005] data handed over for a refused name', () => {
  it('[SEC-005] a refused name closes the data, in the temporary store and in the content store', async () => {
    // Arrange: stores that would fail on any S3 call, and two open bodies
    const noS3 = {} as S3Client;
    const temporary = new S3TemporaryFileStorage(noS3, 'bucket', 1024);
    const content = new S3ContentFileStore(noS3, 'bucket', 1024);
    const [first, second, kept] = [lazyBody(1), lazyBody(1), lazyBody(1)];
    // Act
    const saving = temporary.saveFile('./a.png', first, { id: 'u1' } as IUser, new Date());
    const putting = content.put('c1', 'a//b.png', second);
    const key = keyForUpload(kept, () => 'content/c1/a.png');
    // Assert
    await expect(saving).rejects.toThrow('unsafe file name');
    await expect(putting).rejects.toThrow('unsafe file name');
    expect([first.destroyed, second.destroyed]).toEqual([true, true]);
    expect([key, kept.destroyed]).toEqual(['content/c1/a.png', false]);
  });
});

describe('[H5P-004] S3 request details', () => {
  it('[H5P-004] builds inclusive byte ranges for video seeking', () => {
    expect(rangeHeader()).toBeUndefined();
    expect(rangeHeader(0, 99)).toBe('bytes=0-99');
    expect(rangeHeader(100)).toBe('bytes=100-');
  });

  it('[H5P-004] recognises the SDK error shapes for a missing object', () => {
    expect(isNotFound({ name: 'NoSuchKey' })).toBe(true);
    expect(isNotFound({ name: 'NotFound' })).toBe(true);
    expect(isNotFound({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(isNotFound({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } })).toBe(false);
  });
});

describe('[SEC-005] size-limited uploads', () => {
  it('[SEC-005] rejects an oversize body and releases the source stream', async () => {
    const body = Readable.from([Buffer.alloc(600), Buffer.alloc(600)]);
    const s3 = { send: async () => ({}) } as unknown as S3Client;
    await expect(limitedUpload(s3, { Bucket: 'b', Key: 'k' }, body, 1000)).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
    expect(body.destroyed).toBe(true);
  });

  it('[H5P-004] reports the S3 error of a failed multipart upload, not the stream abort', async () => {
    // Arrange: an S3 client whose every request fails with NoSuchBucket, and a lazy 40 MB body.
    const noSuchBucket = Object.assign(new Error('The specified bucket does not exist'), {
      name: 'NoSuchBucket',
      $metadata: { httpStatusCode: 404 },
    });
    const s3 = {
      config: { requestChecksumCalculation: async () => 'WHEN_REQUIRED' },
      send: async () => {
        throw noSuchBucket;
      },
    } as unknown as S3Client;
    const body = lazyBody(40);
    // Act and assert
    await expect(
      limitedUpload(s3, { Bucket: 'missing', Key: 'k' }, body, 50 * 1024 * 1024),
    ).rejects.toMatchObject({ name: 'NoSuchBucket' });
    expect(body.destroyed).toBe(true);
  });
});
