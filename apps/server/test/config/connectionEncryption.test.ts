/**
 * Tests for the production rule that the database, Redis and S3 connections are encrypted (D-109).
 *
 * Spec: DATA-004
 */
import { describe, expect, it } from 'vitest';
import { connectionEncryptionProblems } from '../../src/config/connectionEncryption.js';
import { envProblems, productionEnv, VALID_ENV } from '../support/authEnv.js';

const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');
const problemsAt = (env: Record<string, string>): string[] => envProblems(env, AUTUMN_2026);
const DATABASE = 'postgresql://hvli_app:s3cret-Passw0rd@db.hvl.no:5432/hvli';
const DATABASE_PROBLEM =
  'DATABASE_URL: production needs an encrypted connection; add sslmode=verify-full (require and verify-ca ' +
  'are accepted) (DATA-004)';
const ENCRYPTED = {
  DATABASE_URL: `${DATABASE}?sslmode=verify-full`,
  REDIS_URL: 'rediss://redis.hvl.no:6380',
};

describe('[DATA-004] production refuses clear-text connections', () => {
  it('[DATA-004] accepts the production fixture, and development keeps its plain local services', () => {
    expect(problemsAt(productionEnv())).toEqual([]);
    expect(problemsAt({ ...VALID_ENV, S3_ENDPOINT: 'http://localhost:5000' })).toEqual([]);
  });

  it.each(['require', 'verify-ca', 'verify-full'])(
    '[DATA-004] accepts DATABASE_URL with sslmode=%s',
    (mode) => {
      const env = { ...ENCRYPTED, DATABASE_URL: `${DATABASE}?connection_limit=5&sslmode=${mode}` };
      expect(connectionEncryptionProblems(env)).toEqual([]);
    },
  );

  it.each([
    ['no sslmode', DATABASE],
    ['sslmode=disable', `${DATABASE}?sslmode=disable`],
    ['sslmode=prefer, which may fall back to clear text', `${DATABASE}?sslmode=prefer`],
    ['sslmode=allow', `${DATABASE}?sslmode=allow`],
    ['node-postgres’s ssl=true alone', `${DATABASE}?ssl=true`],
    [
      'a later sslmode=disable overriding an earlier verify-full',
      `${DATABASE}?sslmode=verify-full&sslmode=disable`,
    ],
    ['an upper-case mode libpq does not know', `${DATABASE}?sslmode=VERIFY-FULL`],
  ])('[DATA-004] refuses DATABASE_URL with %s, naming no value', (_case, url) => {
    // Act
    const problems = problemsAt(productionEnv({ DATABASE_URL: url }));
    // Assert
    expect(problems).toEqual([DATABASE_PROBLEM]);
    expect(problems.join('\n')).not.toContain('s3cret');
    expect(problems.join('\n')).not.toContain('db.hvl.no');
  });

  it('[DATA-004] refuses redis:// and an http S3 endpoint, and accepts rediss:// and https', () => {
    // Act
    const plain = problemsAt(
      productionEnv({ REDIS_URL: 'redis://:pw@redis.hvl.no:6379', S3_ENDPOINT: 'http://s3.hvl.no' }),
    );
    const encrypted = connectionEncryptionProblems({ ...ENCRYPTED, S3_ENDPOINT: 'https://s3.hvl.no' });
    // Assert
    expect(plain).toEqual([
      'REDIS_URL: production needs an encrypted connection; use rediss:// (DATA-004)',
      'S3_ENDPOINT: production needs an encrypted connection; use https (DATA-004)',
    ]);
    expect(encrypted).toEqual([]);
  });

  it('[DATA-004] judges AWS itself (no S3_ENDPOINT) as encrypted', () => {
    expect(connectionEncryptionProblems({ ...ENCRYPTED, S3_ENDPOINT: undefined })).toEqual([]);
  });
});
