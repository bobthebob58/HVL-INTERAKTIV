/**
 * Tests for the Session 3 environment variables: origins, Feide lists, key rings and `LTI_PLATFORMS`.
 *
 * Spec: DOC-008, LTI-001, LTI-003, AUTH-002
 */
import { describe, expect, it } from 'vitest';
import { InvalidEnvironmentError, loadEnv } from '../../src/config/env.js';
import { VALID_ENV } from '../support/authEnv.js';

const problemsOf = (env: Record<string, string>): string[] => {
  try {
    loadEnv(env);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEnvironmentError);
    return (error as InvalidEnvironmentError).problems;
  }
};

const PLATFORM = {
  name: 'Canvas',
  issuer: 'https://canvas.instructure.com',
  clientId: '10000000000001',
  authEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect',
  tokenEndpoint: 'https://sso.canvaslms.com/login/oauth2/token',
  jwksUrl: 'https://sso.canvaslms.com/api/lti/security/jwks',
  deployments: ['1:abc'],
};

describe('[DOC-008] Session 3 defaults', () => {
  it('[DOC-008] applies the documented defaults', () => {
    // Act
    const env = loadEnv(VALID_ENV);
    // Assert
    expect(env).toMatchObject({
      PUBLIC_BASE_URL: 'http://localhost:3000',
      PORT: 3000,
      TRUST_PROXY: 0,
      CANVAS_ORIGINS: [],
      LTI_PLATFORMS: [],
      LTI_TOKEN_MAX_AGE_SECONDS: 10,
      FEIDE_ISSUER: 'https://auth.dataporten.no',
      FEIDE_GROUPS_API_URL: 'https://groups-api.dataporten.no',
      ALLOWED_FEIDE_ORGS: ['hvl.no'],
      ADMIN_FEIDE_IDS: [],
      AUTHOR_COURSE_GROUPS: [],
    });
    expect(env.IDENTITY_HASH_KEYS.current.id).toBe('t1');
  });

  it('[DOC-008] requires the Feide client and the three key rings', () => {
    const names = ['FEIDE_CLIENT_ID', 'FEIDE_CLIENT_SECRET', 'IDENTITY_HASH_KEYS', 'DATA_ENCRYPTION_KEYS'];
    const env = Object.fromEntries(Object.entries(VALID_ENV).filter(([name]) => !names.includes(name)));
    expect(problemsOf({ ...env, URL_SIGNING_KEYS: '' }).map((p) => p.split(':')[0])).toEqual([
      ...names,
      'URL_SIGNING_KEYS',
    ]);
  });

  it('[DOC-008] names a bad key ring without echoing it', () => {
    const problems = problemsOf({ ...VALID_ENV, DATA_ENCRYPTION_KEYS: 'k=c2hvcnQ=' });
    expect(problems).toEqual(['DATA_ENCRYPTION_KEYS: key k is shorter than 32 bytes']);
  });
});

describe('[LTI-003] public URL and frame origins', () => {
  it('[LTI-003] reduces PUBLIC_BASE_URL to its origin and refuses a path', () => {
    expect(loadEnv({ ...VALID_ENV, PUBLIC_BASE_URL: 'https://interaktiv.hvl.no/' }).PUBLIC_BASE_URL).toBe(
      'https://interaktiv.hvl.no',
    );
    expect(problemsOf({ ...VALID_ENV, PUBLIC_BASE_URL: 'https://hvl.no/interaktiv' })[0]).toMatch(
      /^PUBLIC_BASE_URL: must be an origin/,
    );
    expect(problemsOf({ ...VALID_ENV, PUBLIC_BASE_URL: 'javascript:alert(1)' })[0]).toMatch(
      /^PUBLIC_BASE_URL:/,
    );
  });

  it('[LTI-003] accepts a list of exact origins for CANVAS_ORIGINS and refuses anything else', () => {
    // Act
    const env = loadEnv({
      ...VALID_ENV,
      CANVAS_ORIGINS: 'https://hvl.instructure.com, https://hvl.test.instructure.com',
    });
    // Assert
    expect(env.CANVAS_ORIGINS).toEqual(['https://hvl.instructure.com', 'https://hvl.test.instructure.com']);
    for (const bad of [
      'https://hvl.instructure.com/',
      'https://x.no/path',
      '*',
      'hvl.instructure.com',
      "'self'",
    ]) {
      expect(problemsOf({ ...VALID_ENV, CANVAS_ORIGINS: `https://ok.no,${bad}` }), bad).toEqual([
        'CANVAS_ORIGINS: entry 2 is not an origin like https://host',
      ]);
    }
  });
});

describe('[AUTH-002] Feide role lists', () => {
  it('[AUTH-002] lower-cases Feide IDs, realms and groups, and refuses malformed entries', () => {
    // Act
    const env = loadEnv({
      ...VALID_ENV,
      ADMIN_FEIDE_IDS: ' Admin@HVL.no ,kari@hvl.no',
      ALLOWED_FEIDE_ORGS: 'HVL.no',
      AUTHOR_COURSE_GROUPS: 'fc:fs:fs:emne:hvl.no:PPU101',
    });
    // Assert
    expect(env.ADMIN_FEIDE_IDS).toEqual(['admin@hvl.no', 'kari@hvl.no']);
    expect(env.ALLOWED_FEIDE_ORGS).toEqual(['hvl.no']);
    expect(env.AUTHOR_COURSE_GROUPS).toEqual(['fc:fs:fs:emne:hvl.no:ppu101']);
    expect(problemsOf({ ...VALID_ENV, ADMIN_FEIDE_IDS: 'admin' })).toEqual([
      'ADMIN_FEIDE_IDS: entry 1 is not a Feide ID like name@hvl.no',
    ]);
    expect(problemsOf({ ...VALID_ENV, ALLOWED_FEIDE_ORGS: 'hvl' })[0]).toMatch(
      /^ALLOWED_FEIDE_ORGS: entry 1/,
    );
    expect(problemsOf({ ...VALID_ENV, AUTHOR_COURSE_GROUPS: 'emne:ppu' })[0]).toMatch(
      /^AUTHOR_COURSE_GROUPS:/,
    );
    expect(problemsOf({ ...VALID_ENV, AUTHOR_COURSE_GROUPS: 'fc:fs:fs:emne:hvl.no:' })[0]).toMatch(
      /^AUTHOR_COURSE_GROUPS: entry 1/,
    );
  });
});

describe('[LTI-001] LTI_PLATFORMS', () => {
  it('[LTI-001] parses a JSON array of platforms with their deployments', () => {
    const env = loadEnv({ ...VALID_ENV, LTI_PLATFORMS: JSON.stringify([PLATFORM]) });
    expect(env.LTI_PLATFORMS).toEqual([PLATFORM]);
  });

  it('[LTI-001] refuses bad JSON, missing deployments, unknown fields, non-http URLs and duplicates', () => {
    // Arrange
    const cases: [string, RegExp][] = [
      ['[{', /^LTI_PLATFORMS: is not valid JSON$/],
      [JSON.stringify([{ ...PLATFORM, deployments: [] }]), /^LTI_PLATFORMS\.0\.deployments:/],
      [JSON.stringify([{ ...PLATFORM, privateKey: 'x' }]), /^LTI_PLATFORMS\.0:/],
      [JSON.stringify([{ ...PLATFORM, jwksUrl: 'file:///etc/passwd' }]), /^LTI_PLATFORMS\.0\.jwksUrl:/],
      [JSON.stringify({ ...PLATFORM }), /^LTI_PLATFORMS:/],
      [
        JSON.stringify([PLATFORM, { ...PLATFORM, name: 'Copy' }]),
        /platform 2 repeats an issuer and client ID/,
      ],
    ];
    // Act and assert
    for (const [raw, expected] of cases) {
      const problems = problemsOf({ ...VALID_ENV, LTI_PLATFORMS: raw });
      expect(problems.length, raw).toBeGreaterThan(0);
      expect(problems[0], raw).toMatch(expected);
    }
  });

  it('[LTI-001] allows one issuer with several client IDs (every hosted Canvas shares one issuer)', () => {
    const two = [PLATFORM, { ...PLATFORM, clientId: '10000000000002' }];
    expect(loadEnv({ ...VALID_ENV, LTI_PLATFORMS: JSON.stringify(two) }).LTI_PLATFORMS).toHaveLength(2);
  });
});
