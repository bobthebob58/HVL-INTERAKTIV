/**
 * Tests for startup configuration validation.
 *
 * Spec: DOC-008, DATA-002
 */
import { describe, it, expect } from 'vitest';
import { InvalidEnvironmentError, loadEnv } from '../../src/config/env.js';

const SECRET = Buffer.alloc(32, 7).toString('base64');
const VALID = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'very-secret-value',
  PSEUDONYM_SECRETS: `2026=${SECRET}`,
};

const problemsOf = (env: Record<string, string>): string[] => {
  try {
    loadEnv(env);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEnvironmentError);
    return (error as InvalidEnvironmentError).problems;
  }
};

describe('[DOC-008] configuration validation', () => {
  it('[DOC-008] applies documented defaults to a minimal valid environment', () => {
    const env = loadEnv(VALID);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      S3_REGION: 'eu-north-1',
      S3_FORCE_PATH_STYLE: true,
      S3_CONTENT_BUCKET: 'hvli-content',
      H5P_LIBRARY_DIR: 'var/h5p/libraries',
    });
    expect(env.S3_ENDPOINT).toBeUndefined();
    expect(env.PSEUDONYM_SECRETS.get(2026)).toHaveLength(32);
  });

  it('[DOC-008] treats empty values as unset', () => {
    expect(loadEnv({ ...VALID, S3_ENDPOINT: '', H5P_SITE_UUID: '' }).S3_ENDPOINT).toBeUndefined();
  });

  it('[DOC-008] names every missing variable and points to .env.example', () => {
    try {
      loadEnv({});
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      for (const name of Object.keys(VALID)) expect(message).toContain(name);
      expect(message).toContain('apps/server/.env.example');
    }
  });

  it('[DOC-008] rejects malformed values by variable name', () => {
    const problems = problemsOf({ ...VALID, DATABASE_URL: 'mysql://x', S3_FORCE_PATH_STYLE: 'yes' });
    expect(problems.map((p) => p.split(':')[0])).toEqual(['DATABASE_URL', 'S3_FORCE_PATH_STYLE']);
  });

  it('[DOC-008] never echoes secret values in error messages', () => {
    const problems = problemsOf({ ...VALID, PSEUDONYM_SECRETS: '2026=c2hvcnQ=', S3_ENDPOINT: 'not a url' });
    expect(problems.join('\n')).not.toContain('c2hvcnQ=');
    expect(problems.join('\n')).toContain('PSEUDONYM_SECRETS: secret for 2026 is shorter than 32 bytes');
  });
});

describe('[DATA-002] pseudonym secret configuration', () => {
  it('[DATA-002] parses one secret per academic year', () => {
    const env = loadEnv({ ...VALID, PSEUDONYM_SECRETS: `2025=${SECRET}, 2026=${SECRET}` });
    expect([...env.PSEUDONYM_SECRETS.keys()]).toEqual([2025, 2026]);
  });

  it('[DATA-002] rejects duplicate years and malformed entries', () => {
    expect(problemsOf({ ...VALID, PSEUDONYM_SECRETS: `2026=${SECRET},2026=${SECRET}` })).toEqual([
      'PSEUDONYM_SECRETS: year 2026 is listed twice',
    ]);
    expect(problemsOf({ ...VALID, PSEUDONYM_SECRETS: 'current-secret' })).toEqual([
      'PSEUDONYM_SECRETS: entry 1 is not "YYYY=<base64>"',
    ]);
  });
});
