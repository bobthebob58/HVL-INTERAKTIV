/**
 * Integration tests for content and temporary-file storage on PostgreSQL and S3.
 *
 * Spec: H5P-004, SEC-005
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { IContentMetadata, IUser } from '@lumieducation/h5p-server';
import type { S3Client } from '@aws-sdk/client-s3';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { PrismaContentStorage } from '../../src/h5p/storage/PrismaContentStorage.js';
import { S3ContentFileStore } from '../../src/h5p/storage/S3ContentFileStore.js';
import { S3TemporaryFileStorage } from '../../src/h5p/storage/S3TemporaryFileStorage.js';
import { FileTooLargeError } from '../../src/h5p/storage/s3Objects.js';
import { describeWithServices, serviceEnv } from '../support/services.js';
import { createTestBucket, readAll, removeTestBucket, streamOf } from '../support/storageFixtures.js';

const metadata = (mainLibrary: string, deps: [string, number, number][]): IContentMetadata =>
  ({
    title: `Test ${mainLibrary}`,
    mainLibrary,
    language: 'nn',
    license: 'U',
    defaultLanguage: 'nn',
    embedTypes: ['iframe'],
    preloadedDependencies: deps.map(([machineName, majorVersion, minorVersion]) => ({
      machineName,
      majorVersion,
      minorVersion,
    })),
  }) as IContentMetadata;

describeWithServices('[H5P-004] content storage on PostgreSQL and S3', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  let s3: S3Client;
  let bucket: string;
  let content: PrismaContentStorage;
  let temporary: S3TemporaryFileStorage;
  let author: IUser;

  beforeAll(async () => {
    ({ s3, bucket } = await createTestBucket('content'));
    content = new PrismaContentStorage(db, new S3ContentFileStore(s3, bucket, 1024));
    temporary = new S3TemporaryFileStorage(s3, bucket, 1024);
    const row = await db.user.create({ data: { kind: 'staff' } });
    author = { id: row.id, name: 'not stored', email: 'not-stored@example.org', type: 'local' };
  });

  afterAll(async () => {
    await db.h5PContent.deleteMany({ where: { ownerUserId: author.id } });
    await db.user.delete({ where: { id: author.id } });
    await removeTestBucket(s3, bucket);
    await db.$disconnect();
  });

  it('[H5P-004] stores, reads, updates and lists an activity', async () => {
    // Act: store an activity
    const id = await content.addContent(
      metadata('H5P.MultiChoice', [['H5P.MultiChoice', 1, 16]]),
      { question: 'Kva?' },
      author,
    );
    // Assert: it exists and reads back
    expect(await content.contentExists(id)).toBe(true);
    expect(await content.getParameters(id)).toEqual({ question: 'Kva?' });
    expect((await content.getMetadata(id)).mainLibrary).toBe('H5P.MultiChoice');
    // Act and assert: an update keeps the ID, the list holds it, an unknown ID does not exist
    expect(
      await content.addContent(metadata('H5P.MultiChoice', []), { question: 'Kvifor?' }, author, id),
    ).toBe(id);
    expect(await content.getParameters(id)).toEqual({ question: 'Kvifor?' });
    expect(await content.listContent(author)).toContain(id);
    expect(await content.contentExists('not-a-uuid')).toBe(false);
  });

  it('[H5P-004] keeps files in S3, with a range read and a file list in the database', async () => {
    const id = await content.addContent(metadata('H5P.Blanks', []), {}, author);
    await content.addFile(id, 'images/a.txt', streamOf('0123456789'));
    expect(await content.listFiles(id, author)).toEqual(['images/a.txt']);
    expect(await content.fileExists(id, 'images/a.txt')).toBe(true);
    expect((await content.getFileStats(id, 'images/a.txt', author)).size).toBe(10);
    expect(await readAll(await content.getFileStream(id, 'images/a.txt', author, 2, 4))).toBe('234');
    await content.deleteFile(id, 'images/a.txt');
    expect(await content.fileExists(id, 'images/a.txt')).toBe(false);
  });

  it('[SEC-005] refuses files above the size limit and unsafe file names', async () => {
    const id = await content.addContent(metadata('H5P.Blanks', []), {}, author);
    await expect(content.addFile(id, 'big.bin', streamOf(Buffer.alloc(1025)))).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
    await expect(content.addFile(id, '../escape.txt', streamOf('x'))).rejects.toThrow('unsafe file name');
    expect(await content.listFiles(id, author)).toEqual([]);
  });

  it('[H5P-004] counts library usage as main library and as dependency', async () => {
    const lib = { machineName: 'H5P.TestLib', majorVersion: 9, minorVersion: 1 };
    await content.addContent(metadata('H5P.TestLib', [['H5P.TestLib', 9, 1]]), {}, author);
    await content.addContent(metadata('H5P.Column', [['H5P.TestLib', 9, 1]]), {}, author);
    await content.addContent(metadata('H5P.Column', [['H5P.TestLib', 9, 2]]), {}, author);
    expect(await content.getUsage(lib)).toEqual({ asMainLibrary: 1, asDependency: 1 });
  });

  it('[H5P-004] deletes an activity together with its files', async () => {
    const id = await content.addContent(metadata('H5P.Blanks', []), {}, author);
    await content.addFile(id, 'a.txt', streamOf('a'));
    await content.deleteContent(id);
    expect(await content.contentExists(id)).toBe(false);
    await expect(content.getFileStream(id, 'a.txt', author)).rejects.toThrow();
  });

  it('[H5P-004] keeps temporary uploads per author with their expiry', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    await temporary.saveFile('images/tmp-1.png', streamOf('png'), author, expiresAt);
    const other: IUser = { ...author, id: '00000000-0000-7000-8000-000000000000' };
    expect(await temporary.fileExists('images/tmp-1.png', author)).toBe(true);
    expect(await temporary.fileExists('images/tmp-1.png', other)).toBe(false);
    expect(await readAll(await temporary.getFileStream('images/tmp-1.png', author))).toBe('png');
    const listed = await temporary.listFiles();
    expect(listed).toContainEqual({ filename: 'images/tmp-1.png', ownedByUserId: author.id, expiresAt });
    await temporary.deleteFile('images/tmp-1.png', author.id);
    expect(await temporary.listFiles(author)).toEqual([]);
  });
});
