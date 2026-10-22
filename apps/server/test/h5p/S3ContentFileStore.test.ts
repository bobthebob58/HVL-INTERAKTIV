/**
 * Unit test for bulk deletion of an activity's files with a scripted S3 client.
 *
 * Spec: H5P-004
 */
import { describe, it, expect } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3ContentFileStore } from '../../src/h5p/storage/S3ContentFileStore.js';

const scripted = (deleteResult: object): S3Client =>
  ({
    send: async (command: { constructor: { name: string } }) =>
      command.constructor.name === 'ListObjectsV2Command'
        ? { Contents: [{ Key: 'content/c1/a.png' }, { Key: 'content/c1/b.png' }] }
        : deleteResult,
  }) as unknown as S3Client;

describe('[H5P-004] deleting the files of an activity', () => {
  it('[H5P-004] succeeds when S3 deletes every file', async () => {
    await expect(
      new S3ContentFileStore(scripted({ Deleted: [{}, {}] }), 'b', 10).deleteAll('c1'),
    ).resolves.toBeUndefined();
  });

  it('[H5P-004] fails when S3 reports files it could not delete, so no orphaned media is left unnoticed', async () => {
    const store = new S3ContentFileStore(
      scripted({ Errors: [{ Key: 'content/c1/b.png', Code: 'AccessDenied' }] }),
      'b',
      10,
    );
    await expect(store.deleteAll('c1')).rejects.toThrow(
      'could not delete 1 file(s) of content c1: AccessDenied',
    );
  });
});
