/**
 * s3Client — creates the S3 client for content and temporary files from the validated config.
 *
 * Why: every S3-compatible store we target (MinIO, Ceph, Sikt object storage, the test emulator) needs the
 *      same endpoint, region and path-style settings; building the client in one place keeps them equal.
 * Spec: H5P-004
 * Invariants: credentials come only from config (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY), never from files.
 * Collaborators: ../config/env.ts, ../h5p/storage/S3ContentFileStore.ts, ../h5p/storage/S3TemporaryFileStorage.ts.
 * Tests: apps/server/test/h5p/contentStorage.int.test.ts, apps/server/test/h5p/sharedState.int.test.ts
 */
import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.js';

/**
 * Creates an S3 client.
 * @param env - The S3 part of the validated config.
 * @returns A client for the configured endpoint and region.
 */
export function createS3Client(
  env: Pick<
    Env,
    'S3_ENDPOINT' | 'S3_REGION' | 'S3_ACCESS_KEY_ID' | 'S3_SECRET_ACCESS_KEY' | 'S3_FORCE_PATH_STYLE'
  >,
): S3Client {
  return new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}
