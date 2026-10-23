/**
 * Tests for the Session 3 production rules: https everywhere, strong ring keys, and no key used twice.
 *
 * Spec: AUTH-001, LTI-001, LTI-002, DATA-002
 */
import { describe, expect, it } from 'vitest';
import { InvalidEnvironmentError, loadEnv } from '../../src/config/env.js';
import { productionEnv, randomKey, VALID_ENV } from '../support/authEnv.js';

const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');
const problemsAt = (env: Record<string, string>): string[] => {
  try {
    loadEnv(env, AUTUMN_2026);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEnvironmentError);
    return (error as InvalidEnvironmentError).problems;
  }
};
const HTTPS_PLATFORM = {
  name: 'Canvas',
  issuer: 'https://canvas.instructure.com',
  clientId: '1',
  authEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect',
  tokenEndpoint: 'https://sso.canvaslms.com/login/oauth2/token',
  jwksUrl: 'https://sso.canvaslms.com/api/lti/security/jwks',
  deployments: ['1:a'],
};

describe('[AUTH-001] production requires https', () => {
  it('[AUTH-001] accepts the production fixture, and development accepts plain http', () => {
    expect(problemsAt(productionEnv({ CANVAS_ORIGINS: 'https://hvl.instructure.com' }))).toEqual([]);
    expect(problemsAt({ ...VALID_ENV, FEIDE_ISSUER: 'http://localhost:4200' })).toEqual([]);
  });

  it('[AUTH-001] refuses an http Feide issuer, Groups API, public URL or Canvas origin', () => {
    // Act
    const problems = problemsAt(
      productionEnv({
        PUBLIC_BASE_URL: 'http://interaktiv.hvl.no',
        FEIDE_ISSUER: 'http://auth.dataporten.no',
        FEIDE_GROUPS_API_URL: 'http://groups-api.dataporten.no',
        CANVAS_ORIGINS: 'https://hvl.instructure.com,http://evil.example',
      }),
    );
    // Assert
    expect(problems).toEqual([
      'PUBLIC_BASE_URL: must use https in production',
      'FEIDE_ISSUER: must use https in production',
      'FEIDE_GROUPS_API_URL: must use https in production',
      'CANVAS_ORIGINS entry 2: must use https in production',
    ]);
  });

  it('[LTI-001] refuses an LTI platform with any http endpoint', () => {
    const platform = {
      ...HTTPS_PLATFORM,
      clientId: '2',
      jwksUrl: 'http://sso.canvaslms.com/api/lti/security/jwks',
    };
    expect(problemsAt(productionEnv({ LTI_PLATFORMS: JSON.stringify([HTTPS_PLATFORM, platform]) }))).toEqual([
      'LTI_PLATFORMS platform 2 jwksUrl: must use https in production',
    ]);
  });
});

describe('[LTI-002] production ring keys', () => {
  it('[LTI-002] refuses readable-text and low-entropy ring keys, naming only the key ID', () => {
    // Arrange: the development example and a fixture key of one repeated byte.
    const text = Buffer.from('dev-only-data-encryption-key-1-do-not-use').toString('base64');
    const zeros = Buffer.alloc(32).toString('base64');
    // Act
    const problems = problemsAt(
      productionEnv({
        DATA_ENCRYPTION_KEYS: `dev1=${text}`,
        URL_SIGNING_KEYS: `p1=${randomKey(4)},old=${zeros}`,
      }),
    );
    // Assert
    expect(problems).toEqual([
      'DATA_ENCRYPTION_KEYS: key dev1 is readable text; use `openssl rand -base64 32`',
      'URL_SIGNING_KEYS: key old is not random enough; use `openssl rand -base64 32`',
    ]);
    expect(problems.join('\n')).not.toContain(text);
  });

  it('[DATA-002] refuses a key used in two rings, or in a ring and the pseudonym secrets', () => {
    // Act
    const problems = problemsAt(
      productionEnv({
        PSEUDONYM_SECRETS: `2026=${randomKey(1)}`,
        IDENTITY_HASH_KEYS: `a=${randomKey(1)}`,
        DATA_ENCRYPTION_KEYS: `b=${randomKey(3)}`,
        URL_SIGNING_KEYS: `c=${randomKey(3)}`,
      }),
    );
    // Assert
    expect(problems).toEqual([
      'IDENTITY_HASH_KEYS: key a is also used in PSEUDONYM_SECRETS 2026; every place needs its own key',
      'URL_SIGNING_KEYS: key c is also used in DATA_ENCRYPTION_KEYS b; every place needs its own key',
    ]);
  });
});
