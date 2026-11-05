/**
 * connectionEncryption — the production rule that the database, Redis and S3 connections are encrypted.
 *
 * Why: DATA-004 asks for TLS 1.2 or later on all traffic. A connection URL without TLS still works, silently in
 *      clear text, so D-109 makes production refuse to start with one rather than leave it to a checklist.
 * Spec: DATA-004
 * Invariants:
 *   - `DATABASE_URL` needs `sslmode` `require`, `verify-ca` or `verify-full`: the parameter libpq tools and
 *     node-postgres both read (node-postgres's own `ssl=true` is not accepted). `disable`, `allow` and `prefer` may
 *     fall back to clear text in libpq tools, so they are refused.
 *   - `REDIS_URL` must be `rediss://`; `S3_ENDPOINT`, when set, must be `https:` (unset means AWS, always https).
 *   - Messages name the variable and the rule, never the URL (it holds a password) (D-109 amendment of 2026-11-04).
 * Collaborators: ./productionChecks.ts (calls it in production), ./env.ts.
 * Tests: apps/server/test/config/connectionEncryption.test.ts
 */
import type { Env } from './env.js';

/** The `sslmode` values that always encrypt (libpq's names; `verify-full` is the one to use). */
export const ENCRYPTED_SSL_MODES: readonly string[] = ['require', 'verify-ca', 'verify-full'];

/** The variables the encryption rule reads. */
export type EncryptionCheckedEnv = Pick<Env, 'DATABASE_URL' | 'REDIS_URL' | 'S3_ENDPOINT'>;

// WHY: `new URL` keeps a duplicated parameter; libpq and node-postgres read the last one, so it is the one judged.
const sslModeOf = (url: string): string | undefined => {
  try {
    return new URL(url).searchParams.getAll('sslmode').at(-1);
  } catch {
    return undefined;
  }
};

const protocolOf = (url: string): string | undefined => {
  try {
    return new URL(url).protocol;
  } catch {
    return undefined;
  }
};

/**
 * Lists the connections that would not be encrypted.
 * @param env - Parsed configuration.
 * @returns One `VARIABLE: reason` message per problem, naming no value.
 */
export function connectionEncryptionProblems(env: EncryptionCheckedEnv): string[] {
  const problems: string[] = [];
  if (!ENCRYPTED_SSL_MODES.includes(sslModeOf(env.DATABASE_URL) ?? '')) {
    problems.push(
      'DATABASE_URL: production needs an encrypted connection; add sslmode=verify-full (require and verify-ca ' +
        'are accepted) (DATA-004)',
    );
  }
  if (protocolOf(env.REDIS_URL) !== 'rediss:') {
    problems.push('REDIS_URL: production needs an encrypted connection; use rediss:// (DATA-004)');
  }
  if (env.S3_ENDPOINT !== undefined && protocolOf(env.S3_ENDPOINT) !== 'https:') {
    problems.push('S3_ENDPOINT: production needs an encrypted connection; use https (DATA-004)');
  }
  return problems;
}
