/**
 * authEnv — environment fixtures for configuration tests: a minimal valid development environment, a
 * production environment whose secrets and URLs pass every production check, and the problems `loadEnv` reports.
 *
 * Why: each Session 3 variable adds a required secret or a production rule, and every configuration test
 *      needs the same baseline. Keeping it here keeps the tests to the one variable they are about.
 * Spec: DOC-008, DATA-002
 * Collaborators: ../../src/config/env.ts (loadEnv, InvalidEnvironmentError).
 * Tests: shared by apps/server/test/config/*.test.ts.
 */
import { expect } from 'vitest';
import { InvalidEnvironmentError, loadEnv } from '../../src/config/env.js';

/** 32 bytes that are not printable text and have 32 distinct values, as `openssl rand` produces. */
export const randomKey = (seed: number): string =>
  Buffer.from(Array.from({ length: 32 }, (_, i) => ((seed * 31 + i * 7) % 128) | 0x80)).toString('base64');

/** A weak, readable test key (development and test only). */
const textKey = (label: string): string =>
  Buffer.from(`test-only-${label}-key-do-not-use-anywhere`).toString('base64');

/** The smallest environment `loadEnv` accepts in development. */
export const VALID_ENV: Readonly<Record<string, string>> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'very-secret-value',
  PSEUDONYM_SECRETS: `2026=${Buffer.alloc(32, 7).toString('base64')}`,
  FEIDE_CLIENT_ID: 'hvli-test',
  FEIDE_CLIENT_SECRET: 'test-only-client-secret',
  IDENTITY_HASH_KEYS: `t1=${textKey('identity')}`,
  DATA_ENCRYPTION_KEYS: `t1=${textKey('encryption')}`,
  URL_SIGNING_KEYS: `t1=${textKey('url-signing')}`,
};

/**
 * A production environment that passes every production check in the 2026/2027 academic year.
 * @param overrides - Variables to change.
 * @returns The environment.
 */
export const productionEnv = (overrides: Record<string, string> = {}): Record<string, string> => ({
  ...VALID_ENV,
  NODE_ENV: 'production',
  PSEUDONYM_SECRETS: `2026=${randomKey(1)}`,
  IDENTITY_HASH_KEYS: `p1=${randomKey(2)}`,
  DATA_ENCRYPTION_KEYS: `p1=${randomKey(3)}`,
  URL_SIGNING_KEYS: `p1=${randomKey(4)}`,
  PUBLIC_BASE_URL: 'https://interaktiv.hvl.no',
  ...overrides,
});

/**
 * The problems `loadEnv` reports for an environment; an error of any other kind fails the test.
 * @param env - The environment.
 * @param now - The time the production checks judge the academic year by (default: now).
 * @returns The problems, or none when the environment loads.
 */
export const envProblems = (env: Record<string, string>, now?: Date): string[] => {
  try {
    loadEnv(env, now);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEnvironmentError);
    return (error as InvalidEnvironmentError).problems;
  }
};
