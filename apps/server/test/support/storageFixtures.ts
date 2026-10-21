/**
 * storageFixtures — creates and removes the buckets, clients and database rows the storage integration tests need.
 *
 * Why: each test file gets its own buckets and its own author row, so runs never see each other's data.
 * Spec: H5P-004
 * Tests: used by test/h5p/contentStorage.int.test.ts and test/h5p/sharedState.int.test.ts.
 */
import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import { createS3Client } from '../../src/infra/s3Client.js';
import { serviceEnv, uniqueName } from './services.js';

/** An S3 client and a fresh bucket name. */
export async function createTestBucket(prefix: string): Promise<{ s3: S3Client; bucket: string }> {
  const s3 = createS3Client(serviceEnv());
  const bucket = uniqueName(prefix);
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  return { s3, bucket };
}

/** Empties and deletes a bucket created by `createTestBucket`. */
export async function removeTestBucket(s3: S3Client, bucket: string): Promise<void> {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  const Objects = (listed.Contents ?? []).map((o) => ({ Key: o.Key }));
  if (Objects.length > 0) await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects } }));
  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
}

/** A readable stream of the given text or bytes. */
export const streamOf = (data: string | Buffer): Readable => Readable.from([Buffer.from(data)]);

/** Reads a stream to a string. */
export async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}
