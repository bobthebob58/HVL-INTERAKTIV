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

const configured = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL && process.env.S3_ACCESS_KEY_ID);

if (!configured && process.env.CI === 'true') {
  throw new Error(
    'CI must run integration tests: set DATABASE_URL, REDIS_URL and S3_* (see apps/server/.env.example).',
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
