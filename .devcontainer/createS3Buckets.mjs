/**
 * createS3Buckets — creates the content and temporary buckets named in apps/server/.env in the local S3 emulator when
 * they are missing: `node .devcontainer/createS3Buckets.mjs`.
 *
 * Why: the server never creates its buckets (its storage only reads and writes objects), and the test beds create
 *      their own (apps/server/test/support/appTestbed.ts). docker-compose.yml's S3 emulator keeps everything in memory,
 *      so the buckets are gone after every start of the dev container; services.sh runs this each time.
 * Spec: H5P-004 (the buckets its storage adapters use); otherwise development tooling for trying the app (owner
 *       request, 2026-10-30).
 * Invariants:
 *   - SECURITY: only an emulator on this machine (`S3_ENDPOINT` on localhost or 127.0.0.1). Any other endpoint is
 *     refused, so a changed .env never creates buckets in a real account.
 *   - An existing bucket is left as it is, so a second run changes nothing.
 *   - The settings are the server's: apps/server/.env, where a variable that is already set wins (as with
 *     `npm start`), with the defaults and client options of ../apps/server/src/config/env.ts and
 *     ../apps/server/src/infra/s3Client.ts.
 * Collaborators: ./services.sh, ../apps/server/.env.example, ../docker-compose.yml.
 * Tests: none automated; README.md in this folder says how to check it.
 */
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const ENV_FILE = new URL('../apps/server/.env', import.meta.url);
// WHY: docker-compose.yml gives the emulator no health check, so `docker compose up --wait` can return before it
// listens; a refused connection is retried once a second for this many attempts.
const CONNECT_ATTEMPTS = 30;

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const env = process.env;
const endpoint = env.S3_ENDPOINT ?? '';
const host = URL.canParse(endpoint) ? new URL(endpoint).hostname : '';
if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(`createS3Buckets: S3_ENDPOINT is not the local emulator (${endpoint || 'empty, so AWS'}).`);
  process.exit(1);
}
const s3 = new S3Client({
  region: env.S3_REGION || 'eu-north-1',
  endpoint,
  forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? '', secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '' },
});

/**
 * Asks the emulator whether a bucket exists, waiting while it does not answer yet.
 * @param {string} bucket - The bucket name.
 * @returns {Promise<boolean>} False when the emulator answers 404.
 */
async function bucketExists(bucket) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404) return false;
      // WHY: an HTTP answer other than 404 is a real problem; only "no answer yet" is worth waiting for.
      if (status !== undefined || attempt >= CONNECT_ATTEMPTS) throw error;
      await sleep(1000);
    }
  }
}

try {
  for (const bucket of [
    env.S3_CONTENT_BUCKET || 'hvli-content',
    env.S3_TEMPORARY_BUCKET || 'hvli-temporary',
  ]) {
    if (await bucketExists(bucket)) {
      console.log(`S3 bucket ${bucket}: exists`);
    } else {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`S3 bucket ${bucket}: created`);
    }
  }
} finally {
  s3.destroy();
}
