/**
 * bucketBackup — the content bucket's half of a backup and a restore: the S3 settings and their checks, copying every
 * object to a folder under its SHA-256, the empty-target check, the upload, and reading every object back.
 *
 * Why: the database names each content file by its S3 key (`H5PContentFile.s3Key`), so a restore needs the bucket's
 *      objects as well as the rows (NFR-002, D-110's backup amendment of 2026-11-05). Files are stored under their
 *      hash, never under their key, so a key such as `../x` can never name a path when a backup is read back.
 * Spec: NFR-002, DATA-004
 * Invariants:
 *   - The settings are the server's (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
 *     `S3_FORCE_PATH_STYLE`, `S3_CONTENT_BUCKET`); an endpoint on another host must be https, the SDK's own
 *     `AWS_ENDPOINT_URL_S3` and `AWS_ENDPOINT_URL` are refused, and configured endpoints are ignored (D-109).
 *   - The bucket is a plain bucket name, never an access point or Outposts ARN (D-109's amendment).
 *   - A restore uploads only into an existing, empty bucket; results count objects and never name a key.
 * Collaborators: @aws-sdk/client-s3 (resolved from apps/server, which pins it), ./backupRun.mjs.
 * Tests: tools/ops/test/backupRoundTrip.test.mjs, tools/ops/test/postgresConnection.test.mjs
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BackupConfigError, isLoopbackHost } from './postgresConnection.mjs';

// WHY: the SDK is a dependency of apps/server (exact pin); resolving it there keeps one version in the repository.
const serverRequire = createRequire(new URL('../../apps/server/package.json', import.meta.url));
const sdk = () => serverRequire('@aws-sdk/client-s3');

const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/**
 * Reads and checks the S3 settings.
 * @param {Record<string, string | undefined>} env - The process environment.
 * @returns {{bucket: string, client: object}} The bucket and the S3Client options.
 * @throws {BackupConfigError} Naming the variable whose value breaks a rule.
 */
export function s3Settings(env) {
  for (const name of ['AWS_ENDPOINT_URL_S3', 'AWS_ENDPOINT_URL']) {
    if (env[name])
      throw new BackupConfigError(`${name} is set; S3_ENDPOINT is the one setting for another store`);
  }
  const endpoint = env.S3_ENDPOINT || undefined;
  if (endpoint && !URL.canParse(endpoint)) throw new BackupConfigError('S3_ENDPOINT is not a URL');
  const url = endpoint ? new URL(endpoint) : undefined;
  if (url && url.protocol !== 'https:' && !isLoopbackHost(url.hostname)) {
    throw new BackupConfigError('S3_ENDPOINT: a store on another host needs https (DATA-004)');
  }
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new BackupConfigError('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must both be set');
  }
  const bucket = env.S3_CONTENT_BUCKET || 'hvli-content';
  if (!BUCKET_NAME.test(bucket)) throw new BackupConfigError('S3_CONTENT_BUCKET must be a plain bucket name');
  return {
    bucket,
    client: {
      region: env.S3_REGION || 'eu-north-1',
      ...(endpoint ? { endpoint } : {}),
      // SECURITY: as the server's own client (apps/server/src/infra/s3Client.ts): no endpoint from the SDK's config.
      ignoreConfiguredEndpointUrls: true,
      forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    },
  };
}

/**
 * Creates the S3 client.
 * @param {{client: object}} settings - From `s3Settings`.
 * @returns {object} An `S3Client`.
 */
export const createS3 = (settings) => new (sdk().S3Client)(settings.client);

const hashing = () => {
  const hash = createHash('sha256');
  let size = 0;
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done(null, chunk);
    },
  });
  return { meter, result: () => ({ sha256: hash.digest('hex'), size }) };
};

const missingBucket = () =>
  new BackupConfigError(
    'the bucket S3_CONTENT_BUCKET names does not exist; create it first (docs/ops/runbook.md)',
  );

async function* everyObject(s3, bucket) {
  let ContinuationToken;
  do {
    const page = await s3
      .send(new (sdk().ListObjectsV2Command)({ Bucket: bucket, ContinuationToken }))
      .catch((error) => Promise.reject(error?.name === 'NoSuchBucket' ? missingBucket() : error));
    yield* page.Contents ?? [];
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

/**
 * Copies every object of a bucket into `<dir>/objects/<sha256>`.
 * @param {object} s3 - The client.
 * @param {string} bucket - The bucket.
 * @param {string} dir - The backup folder (with an `objects` folder).
 * @returns {Promise<{key: string, size: number, sha256: string, contentType?: string}[]>} One entry per object.
 */
export async function downloadBucket(s3, bucket, dir) {
  const objects = [];
  for await (const { Key } of everyObject(s3, bucket)) {
    const answer = await s3.send(new (sdk().GetObjectCommand)({ Bucket: bucket, Key }));
    const temporary = join(dir, 'objects', `.part-${objects.length}`);
    const { meter, result } = hashing();
    await pipeline(answer.Body, meter, createWriteStream(temporary, { mode: 0o600 }));
    const { sha256, size } = result();
    const target = join(dir, 'objects', sha256);
    if (await stat(target).catch(() => undefined)) await rm(temporary);
    else await rename(temporary, target);
    objects.push({
      key: Key,
      size,
      sha256,
      ...(answer.ContentType ? { contentType: answer.ContentType } : {}),
    });
  }
  return objects.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * Refuses a target bucket that is missing or holds any object.
 * @param {object} s3 - The client.
 * @param {string} bucket - The bucket.
 * @throws {BackupConfigError} When the bucket does not exist or is not empty.
 */
export async function assertEmptyBucket(s3, bucket) {
  let page;
  try {
    page = await s3.send(new (sdk().ListObjectsV2Command)({ Bucket: bucket, MaxKeys: 1 }));
  } catch (error) {
    throw error?.name === 'NoSuchBucket' ? missingBucket() : error;
  }
  if ((page.KeyCount ?? 0) > 0 || (page.Contents ?? []).length > 0) {
    throw new BackupConfigError(
      'the bucket S3_CONTENT_BUCKET names is not empty; restore only into an empty one',
    );
  }
}

/**
 * Uploads a backup's objects under their keys.
 * @param {object} s3 - The client.
 * @param {string} bucket - The bucket.
 * @param {string} dir - The backup folder.
 * @param {{key: string, sha256: string, contentType?: string}[]} objects - From the manifest.
 */
export async function uploadObjects(s3, bucket, dir, objects) {
  for (const { key, sha256, contentType } of objects) {
    const Body = await readFile(join(dir, 'objects', sha256));
    await s3.send(
      new (sdk().PutObjectCommand)({
        Bucket: bucket,
        Key: key,
        Body,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    );
  }
}

/**
 * Reads every object back and compares its size and SHA-256 with the manifest.
 * @param {object} s3 - The client.
 * @param {string} bucket - The bucket.
 * @param {{key: string, size: number, sha256: string}[]} objects - From the manifest.
 * @returns {Promise<number>} How many objects are missing or differ.
 */
export async function differingObjects(s3, bucket, objects) {
  let differing = 0;
  for (const { key, size, sha256 } of objects) {
    try {
      const answer = await s3.send(new (sdk().GetObjectCommand)({ Bucket: bucket, Key: key }));
      const { meter, result } = hashing();
      await pipeline(answer.Body, meter, async (source) => {
        for await (const chunk of source) void chunk;
      });
      const read = result();
      if (read.sha256 !== sha256 || read.size !== size) differing += 1;
    } catch {
      differing += 1;
    }
  }
  return differing;
}
