/**
 * Tests for startup configuration validation.
 *
 * Spec: DOC-008, DATA-002
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { loadEnv, loadEnvPart } from '../../src/config/env.js';
import { envProblems, productionEnv, randomKey, VALID_ENV } from '../support/authEnv.js';

const SECRET = Buffer.alloc(32, 7).toString('base64');
const OTHER = Buffer.alloc(32, 8).toString('base64');
const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');
const VALID = { ...VALID_ENV, PSEUDONYM_SECRETS: `2026=${SECRET}` };

describe('[DOC-008] configuration validation', () => {
  it('[DOC-008] applies documented defaults to a minimal valid environment', () => {
    // Act
    const env = loadEnv(VALID);
    // Assert
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
    const problems = envProblems({ ...VALID, DATABASE_URL: 'mysql://x', S3_FORCE_PATH_STYLE: 'yes' });
    expect(problems.map((p) => p.split(':')[0])).toEqual(['DATABASE_URL', 'S3_FORCE_PATH_STYLE']);
  });

  it('[DOC-008] never echoes secret values in error messages', () => {
    const problems = envProblems({ ...VALID, PSEUDONYM_SECRETS: '2026=c2hvcnQ=', S3_ENDPOINT: 'not a url' });
    expect(problems.join('\n')).not.toContain('c2hvcnQ=');
    expect(problems.join('\n')).toContain('PSEUDONYM_SECRETS: secret for 2026 is shorter than 32 bytes');
  });
});

describe('[DATA-002] pseudonym secret configuration', () => {
  it('[DATA-002] parses one secret per academic year', () => {
    const env = loadEnv({ ...VALID, PSEUDONYM_SECRETS: `2025=${SECRET}, 2026=${OTHER}` });
    expect([...env.PSEUDONYM_SECRETS.keys()]).toEqual([2025, 2026]);
  });

  it('[DATA-002] rejects duplicate years and malformed entries', () => {
    expect(envProblems({ ...VALID, PSEUDONYM_SECRETS: `2026=${SECRET},2026=${SECRET}` })).toEqual([
      'PSEUDONYM_SECRETS: year 2026 is listed twice',
    ]);
    expect(envProblems({ ...VALID, PSEUDONYM_SECRETS: 'current-secret' })).toEqual([
      'PSEUDONYM_SECRETS: entry 1 is not "YYYY=<base64>"',
    ]);
  });

  it('[DATA-002] rejects the same secret for two years, so destroying one year unlinks it', () => {
    expect(envProblems({ ...VALID, PSEUDONYM_SECRETS: `2025=${SECRET},2026=${SECRET}` })).toEqual([
      'PSEUDONYM_SECRETS: the secrets for 2025 and 2026 are the same; each year needs its own',
    ]);
  });

  it('[DATA-002] treats secrets that give the same HMAC key as the same secret', () => {
    // Arrange: a key with a zero byte appended, and a long secret beside its SHA-256 digest.
    const key = Buffer.from(randomKey(3), 'base64');
    const padded = Buffer.concat([key, Buffer.alloc(1)]).toString('base64');
    const long = Buffer.alloc(100, 9);
    const hashed = createHash('sha256').update(long).digest().toString('base64');
    // Act and assert: each pair counts as one secret used for two years.
    for (const pair of [
      `2025=${randomKey(3)},2026=${padded}`,
      `2025=${long.toString('base64')},2026=${hashed}`,
    ]) {
      expect(envProblems({ ...VALID, PSEUDONYM_SECRETS: pair }), pair).toEqual([
        'PSEUDONYM_SECRETS: the secrets for 2025 and 2026 are the same; each year needs its own',
      ]);
    }
  });
});

describe('[DATA-002] production-only configuration checks', () => {
  const production = (secrets: string) => productionEnv({ PSEUDONYM_SECRETS: secrets });

  it('[DATA-002] accepts random secrets that cover the current academic year', () => {
    expect(envProblems(production(`2026=${randomKey(1)}`), AUTUMN_2026)).toEqual([]);
  });

  it('[DATA-002] refuses to start without a secret for the current academic year', () => {
    expect(envProblems(production(`2025=${randomKey(1)}`), AUTUMN_2026)).toEqual([
      'PSEUDONYM_SECRETS: no secret for the current academic year 2026/2027',
    ]);
  });

  it('[DATA-002] refuses secrets that are readable text, such as the published examples', () => {
    // Arrange
    const example = Buffer.from('dev-only-pseudonym-secret-2026-do-not-use').toString('base64');
    // Act and assert: production refuses the example, development accepts it.
    expect(envProblems(production(`2026=${example}`), AUTUMN_2026)).toEqual([
      'PSEUDONYM_SECRETS: the 2026 secret is readable text; use `openssl rand -base64 32`',
    ]);
    expect(envProblems({ ...VALID, PSEUDONYM_SECRETS: `2026=${example}` }, AUTUMN_2026)).toEqual([]);
    // Act and assert: with trailing whitespace, production still refuses the example.
    // WHY: `echo … | base64` adds a newline; tabs and CR are text too.
    for (const tail of ['\n', '\r\n', '\t']) {
      const encoded = Buffer.from(`dev-only-pseudonym-secret-2026-do-not-use${tail}`).toString('base64');
      expect(envProblems(production(`2026=${encoded}`), AUTUMN_2026), JSON.stringify(tail)).toEqual([
        'PSEUDONYM_SECRETS: the 2026 secret is readable text; use `openssl rand -base64 32`',
      ]);
    }
  });

  it('[DATA-002] refuses secrets with too few distinct bytes, such as zeros or the test fixtures', () => {
    for (const secret of [Buffer.alloc(32).toString('base64'), SECRET]) {
      expect(envProblems(production(`2026=${secret}`), AUTUMN_2026)).toEqual([
        'PSEUDONYM_SECRETS: the 2026 secret is not random enough; use `openssl rand -base64 32`',
      ]);
    }
  });
});

describe('[DOC-008] partial configuration for tools', () => {
  it('[DOC-008] validates only the requested variables', () => {
    expect(loadEnvPart(['LOG_LEVEL', 'H5P_CORE_DIR'], {})).toEqual({
      LOG_LEVEL: 'info',
      H5P_CORE_DIR: 'h5p/core',
    });
    expect(() => loadEnvPart(['LOG_LEVEL'], { LOG_LEVEL: 'loud' })).toThrow('LOG_LEVEL:');
  });
});
