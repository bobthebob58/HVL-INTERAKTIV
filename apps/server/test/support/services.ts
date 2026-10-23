/**
 * services — decides whether integration tests can reach PostgreSQL, Redis and S3, and builds their config.
 *
 * Why: integration tests read service locations from the environment (D-023). Locally they are skipped
 *      when no services are configured; in CI (`CI=true`) a missing service is an error, never a skip.
 * Spec: H5P-004
 * Tests: shared by every *.int.test.ts file.
 */
import { describe } from 'vitest';
import { loadEnv, type Env } from '../../src/config/env.js';

const REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'PSEUDONYM_SECRETS',
  'FEIDE_CLIENT_ID',
  'FEIDE_CLIENT_SECRET',
  'IDENTITY_HASH_KEYS',
  'DATA_ENCRYPTION_KEYS',
  'URL_SIGNING_KEYS',
];
const missing = REQUIRED.filter((name) => !process.env[name]);
const configured = missing.length === 0;

if (!configured && process.env.CI === 'true') {
  throw new Error(
    `CI must run integration tests; missing ${missing.join(', ')} (see apps/server/.env.example).`,
  );
}
if (!configured) {
  console.warn(
    `Integration tests skipped: ${missing.join(', ')} not set. Run \`docker compose up -d\` and copy ` +
      'apps/server/.env.example to apps/server/.env (D-023).',
  );
}

/** `describe` when services are configured, otherwise `describe.skip` (outside CI only). */
export const describeWithServices = configured ? describe : describe.skip;

/**
 * The validated environment for integration tests.
 * @returns Parsed config from the current process environment.
 */
export const serviceEnv = (): Env => loadEnv(process.env);

/**
 * A unique, S3-safe name for test resources, so parallel or repeated runs never collide.
 * @param prefix - Readable prefix, e.g. "content".
 * @returns e.g. `test-content-lx3k9f-1a2b`.
 */
export const uniqueName = (prefix: string): string =>
  `test-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
