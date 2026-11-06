/**
 * Unit tests for the S3 client's endpoint: only `S3_ENDPOINT`, else AWS itself in `S3_REGION`. The AWS SDK's own
 * endpoint variables and a shared config file's `endpoint_url` would send files past the production checks for TLS
 * and the EEA (D-109 amendment of 2026-11-05), so the client must ignore them. Each test stops the request before it
 * leaves and records where it would have gone.
 *
 * Spec: DATA-004, H5P-004
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createS3Client } from '../../src/infra/s3Client.js';

const S3 = {
  S3_REGION: 'eu-north-1',
  S3_ACCESS_KEY_ID: 'test-key-id',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  S3_FORCE_PATH_STYLE: true,
} as const;

const folder = mkdtempSync(join(tmpdir(), 'hvli-s3client-'));

/** Sends one request through a client and returns where it was going, without sending it. */
async function destinationOf(env: Parameters<typeof createS3Client>[0]): Promise<string> {
  const client = createS3Client(env);
  let destination = '';
  client.middlewareStack.add(
    () => async (args) => {
      const request = args.request as { protocol: string; hostname: string; port?: number };
      destination = `${request.protocol}//${request.hostname}${request.port ? `:${request.port}` : ''}`;
      throw new Error('stopped before sending');
    },
    { step: 'finalizeRequest' },
  );
  await expect(client.send(new ListObjectsV2Command({ Bucket: 'hvli-content' }))).rejects.toThrow('stopped');
  return destination;
}

afterEach(() => vi.unstubAllEnvs());
afterAll(() => rmSync(folder, { recursive: true, force: true }));

describe('[DATA-004] the S3 client goes only where the configuration says', () => {
  it('[DATA-004] AWS_ENDPOINT_URL_S3 and AWS_ENDPOINT_URL are ignored: the client goes to AWS in S3_REGION', async () => {
    // Arrange
    vi.stubEnv('AWS_ENDPOINT_URL_S3', 'http://127.0.0.1:9');
    vi.stubEnv('AWS_ENDPOINT_URL', 'http://127.0.0.2:9');
    // Act
    const destination = await destinationOf(S3);
    // Assert
    expect(destination).toBe('https://s3.eu-north-1.amazonaws.com');
  });

  it('[DATA-004] a shared AWS config file’s endpoint_url is ignored too', async () => {
    // Arrange
    const config = join(folder, 'config');
    writeFileSync(config, '[default]\nendpoint_url = http://127.0.0.3:9\n');
    vi.stubEnv('AWS_CONFIG_FILE', config);
    // Act
    const destination = await destinationOf({ ...S3, S3_REGION: 'eu-west-1' });
    // Assert
    expect(destination).toBe('https://s3.eu-west-1.amazonaws.com');
  });

  it('[H5P-004] S3_ENDPOINT still names the store, whatever the SDK’s own variables say', async () => {
    // Arrange
    vi.stubEnv('AWS_ENDPOINT_URL_S3', 'http://127.0.0.1:9');
    // Act
    const destination = await destinationOf({ ...S3, S3_ENDPOINT: 'https://s3.hvl.no' });
    // Assert
    expect(destination).toBe('https://s3.hvl.no');
  });
});
