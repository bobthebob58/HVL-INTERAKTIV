/**
 * s3Client — creates the S3 client for content and temporary files from the validated config.
 *
 * Why: every S3-compatible store we target (MinIO, Ceph, Sikt object storage, the test emulator) needs the
 *      same endpoint, region and path-style settings; building the client in one place keeps them equal.
 * Spec: H5P-004, DATA-004
 * Invariants:
 *   - Credentials come only from config (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY), never from files.
 *   - The endpoint comes only from config: `S3_ENDPOINT`, else AWS itself in `S3_REGION`. The AWS SDK's own
 *     `AWS_ENDPOINT_URL_S3`, `AWS_ENDPOINT_URL` and a shared config file's `endpoint_url` are ignored, so they cannot
 *     send the files past the production checks for TLS and the EEA (D-109 amendment of 2026-11-05).
 * Collaborators: ../config/env.ts, ../config/storageResidency.ts, ../h5p/storage/S3ContentFileStore.ts,
 *   ../h5p/storage/S3TemporaryFileStorage.ts.
 * Tests: apps/server/test/infra/s3Client.test.ts, apps/server/test/h5p/contentStorage.int.test.ts,
 *   apps/server/test/h5p/sharedState.int.test.ts
 */
import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.js';

/**
 * Creates an S3 client.
 * @param env - The S3 part of the validated config.
 * @returns A client for the configured endpoint and region, and for no endpoint the SDK reads by itself.
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
    // SECURITY: production checks S3_ENDPOINT and S3_REGION only (DATA-004, D-109); an endpoint the SDK found in the
    // environment or ~/.aws/config would bypass both.
    ignoreConfiguredEndpointUrls: true,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}
