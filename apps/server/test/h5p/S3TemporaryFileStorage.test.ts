/**
 * Unit tests for temporary-file listing with a scripted S3 client.
 *
 * Spec: H5P-004
 */
import { describe, it, expect } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3TemporaryFileStorage } from '../../src/h5p/storage/S3TemporaryFileStorage.js';

/** Listed keys: two of ours, one deleted before HEAD, and three this adapter never writes. */
const KEYS = [
  'tmp/u%401/a.png',
  'tmp/u%401/gone.png',
  'tmp/%E0%A4%A/x.png',
  'tmp/no-owner.png',
  'tmp/u3/',
  'tmp/u2/img/b.png',
];

/** An S3 client that answers ListObjectsV2 and HeadObject from a fixed table; a missing key is a 404. */
const scriptedS3 = (objects: Record<string, Record<string, string>>): S3Client =>
  ({
    send: async (command: { constructor: { name: string }; input: { Key?: string } }) => {
      if (command.constructor.name === 'ListObjectsV2Command') {
        return {
          Contents: KEYS.map((Key) => ({ Key })),
        };
      }
      const metadata = objects[command.input.Key ?? ''];
      if (!metadata)
        throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      return { Metadata: metadata };
    },
  }) as unknown as S3Client;

describe('[H5P-004] temporary file listing', () => {
  it('[H5P-004] skips deleted files and foreign keys, and reads the owner from the key', async () => {
    const storage = new S3TemporaryFileStorage(
      scriptedS3({
        'tmp/u%401/a.png': { expiresat: '2026-10-22T10:00:00.000Z' },
        'tmp/%E0%A4%A/x.png': { expiresat: '2026-10-22T10:00:00.000Z' },
        'tmp/no-owner.png': { expiresat: '2026-10-22T10:00:00.000Z' },
        'tmp/u3/': { expiresat: '2026-10-22T10:00:00.000Z' },
        'tmp/u2/img/b.png': { expiresat: '2026-10-22T11:00:00.000Z', owner: 'ignored' },
      }),
      'bucket',
      1024,
    );
    expect(await storage.listFiles()).toEqual([
      { filename: 'a.png', ownedByUserId: 'u@1', expiresAt: new Date('2026-10-22T10:00:00.000Z') },
      { filename: 'img/b.png', ownedByUserId: 'u2', expiresAt: new Date('2026-10-22T11:00:00.000Z') },
    ]);
  });
});
