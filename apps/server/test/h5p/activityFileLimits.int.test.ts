/**
 * Integration tests of the storage's own hold on the limit for one activity's files, on PostgreSQL and S3: a file
 * is stored only while its activity has room, a file that took the activity past its bytes is not left in the
 * bucket, and files are kept under the stored ID whatever spelling a caller used (D-139, D-131).
 *
 * Spec: SEC-005, H5P-004
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { IContentMetadata, IUser } from '@lumieducation/h5p-server';
import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { ACTIVITY_FILES_OVER_LIMIT } from '../../src/h5p/activityFileBudget.js';
import { PrismaContentStorage } from '../../src/h5p/storage/PrismaContentStorage.js';
import { S3ContentFileStore } from '../../src/h5p/storage/S3ContentFileStore.js';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { describeWithServices, serviceEnv } from '../support/services.js';
import { createTestBucket, removeTestBucket, streamOf } from '../support/storageFixtures.js';

const METADATA = { title: 'Test', mainLibrary: 'H5P.MultiChoice', language: 'nn' } as IContentMetadata;
const OVER = { errorId: ACTIVITY_FILES_OVER_LIMIT, httpStatusCode: 413 };

describeWithServices('[SEC-005] the storage holds the limit for one activity’s files', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  let s3: S3Client;
  let bucket: string;
  let content: PrismaContentStorage;
  let author: IUser;

  beforeAll(async () => {
    ({ s3, bucket } = await createTestBucket('file-limits'));
    // WHY: small limits, so the test stores a handful of bytes: two files and ten bytes for one activity.
    content = new PrismaContentStorage(db, new S3ContentFileStore(s3, bucket, 1024), { files: 2, bytes: 10 });
    const row = await db.user.create({ data: { kind: 'staff' } });
    author = { id: row.id, name: 'not stored', email: 'not-stored@example.org', type: 'local' };
  });
  afterAll(async () => {
    await db.h5PContent.deleteMany({ where: { ownerUserId: author.id } });
    await db.user.delete({ where: { id: author.id } });
    await removeTestBucket(s3, bucket);
    await db.$disconnect();
  });

  const newActivity = () => content.addContent(METADATA, { question: 'Kva?' }, author);
  const keysUnder = async (prefix: string) =>
    ((await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))).Contents ?? []).map(
      (object) => object.Key,
    );

  it('[SEC-005] refuses one file more than an activity may hold, and still lets a file be replaced', async () => {
    // Arrange
    const id = await newActivity();
    await content.addFile(id, 'a.png', streamOf('aa'));
    await content.addFile(id, 'b.png', streamOf('bb'));
    // Act
    const third = content.addFile(id, 'c.png', streamOf('cc'));
    // Assert
    await expect(third).rejects.toMatchObject(OVER);
    await expect(content.addFile(id, 'b.png', streamOf('BBB'))).resolves.toBeUndefined();
    expect((await content.listFiles(id)).sort()).toEqual(['a.png', 'b.png']);
  });

  it('[SEC-005] removes a file that took the activity past its bytes, so nothing of it stays in the bucket', async () => {
    // Arrange: six of ten bytes are used
    const id = await newActivity();
    await content.addFile(id, 'a.png', streamOf('123456'));
    // Act: five more are one too many; four more are the limit
    const tooLarge = content.addFile(id, 'b.png', streamOf('12345'));
    // Assert
    await expect(tooLarge).rejects.toMatchObject(OVER);
    expect(await keysUnder(`content/${String(id)}/`)).toEqual([`content/${String(id)}/a.png`]);
    await expect(content.addFile(id, 'b.png', streamOf('1234'))).resolves.toBeUndefined();
  });

  it('[H5P-004] keeps an activity’s files under its stored ID, whatever spelling stores or deletes them', async () => {
    // Arrange
    const id = String(await newActivity());
    const capitals = id.toUpperCase();
    // Act: a file stored and the activity deleted under the ID in capitals
    await content.addFile(capitals, 'a.png', streamOf('aa'));
    const stored = await keysUnder('content/');
    await content.deleteContent(capitals);
    // Assert: one spelling in the bucket, and nothing left after the delete
    expect(stored).toContain(`content/${id}/a.png`);
    expect(stored.filter((key) => key?.includes(capitals))).toEqual([]);
    expect(await keysUnder(`content/${id}/`)).toEqual([]);
  });
});
