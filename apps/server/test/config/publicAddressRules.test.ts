/**
 * Tests for the rules that follow the server's public address: off a local address the key rules and the https
 * rules hold in every mode, so a wrongly set mode cannot put a reachable server on example keys or plain http.
 *
 * Spec: DOC-008, DATA-002, AUTH-001, LTI-001
 */
import { describe, expect, it } from 'vitest';
import { isLocalAddress } from '../../src/config/publicAddressRules.js';
import { envProblems, productionEnv, randomKey, VALID_ENV } from '../support/authEnv.js';

const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');
const PUBLIC = 'https://interaktiv-test.hvl.no';
/** A development or test installation on an address others can reach, with keys and addresses that pass. */
const reachable = (overrides: Record<string, string> = {}): Record<string, string> => ({
  ...productionEnv({ PUBLIC_BASE_URL: PUBLIC }),
  NODE_ENV: 'development',
  WEB_APP: 'dev',
  DATABASE_URL: VALID_ENV.DATABASE_URL ?? '',
  REDIS_URL: VALID_ENV.REDIS_URL ?? '',
  ...overrides,
});
const problemsAt = (env: Record<string, string>): string[] => envProblems(env, AUTUMN_2026);

describe('[DOC-008] which public addresses are local', () => {
  it('[DOC-008] localhost, .localhost names and the loopback addresses are local; everything else is not', () => {
    // Act and assert: the local spellings, also in capitals and as one decimal number
    for (const url of [
      'http://localhost:3000',
      'http://LOCALHOST:3000',
      'http://tool.localhost:3000',
      'http://127.0.0.1:3000',
      'http://127.8.9.10',
      'http://2130706433:3000',
      'http://[::1]:3000',
    ]) {
      expect(isLocalAddress(url), url).toBe(true);
    }
    // Act and assert: public names, private network addresses and look-alikes are not local
    for (const url of [
      'https://interaktiv.hvl.no',
      'http://localhost.hvl.no',
      'http://notlocalhost:3000',
      'http://192.168.1.20:3000',
      'http://10.0.0.5',
      'http://0.0.0.0:3000',
      'http://[::ffff:127.0.0.1]:3000',
      'http://128.0.0.1',
    ]) {
      expect(isLocalAddress(url), url).toBe(false);
    }
  });
});

describe('[DATA-002] a reachable address is held to the key rules in every mode', () => {
  it('[DATA-002] development and test on a public address accept random keys and https', () => {
    expect(problemsAt(reachable())).toEqual([]);
    expect(problemsAt(reachable({ NODE_ENV: 'test' }))).toEqual([]);
  });

  it('[DATA-002] the example keys are refused on a public address and accepted on a local one', () => {
    // Arrange: the readable-text keys every example and test fixture uses
    const examples = {
      PSEUDONYM_SECRETS: VALID_ENV.PSEUDONYM_SECRETS ?? '',
      IDENTITY_HASH_KEYS: VALID_ENV.IDENTITY_HASH_KEYS ?? '',
      DATA_ENCRYPTION_KEYS: VALID_ENV.DATA_ENCRYPTION_KEYS ?? '',
      URL_SIGNING_KEYS: VALID_ENV.URL_SIGNING_KEYS ?? '',
    };
    // Act
    const problems = problemsAt(reachable({ ...examples, NODE_ENV: 'test' }));
    // Assert: every key is named with its rule and the reason the rule applies, and no key's text is shown
    const why = ' (PUBLIC_BASE_URL is not a local address)';
    expect(problems).toEqual([
      `PSEUDONYM_SECRETS: the 2026 secret is not random enough; use \`openssl rand -base64 32\`${why}`,
      `IDENTITY_HASH_KEYS: key t1 is readable text; use \`openssl rand -base64 32\`${why}`,
      `DATA_ENCRYPTION_KEYS: key t1 is readable text; use \`openssl rand -base64 32\`${why}`,
      `URL_SIGNING_KEYS: key t1 is readable text; use \`openssl rand -base64 32\`${why}`,
    ]);
    expect(problems.join('\n')).not.toContain('test-only');
    for (const local of ['http://localhost:3000', 'http://tool.localhost:3000']) {
      expect(problemsAt({ ...VALID_ENV, ...examples, PUBLIC_BASE_URL: local }), local).toEqual([]);
    }
  });

  it('[DATA-002] a key used in two places is refused on a public address', () => {
    const problems = problemsAt(reachable({ URL_SIGNING_KEYS: `p1=${randomKey(3)}` }));
    expect(problems).toEqual([
      'URL_SIGNING_KEYS: key p1 is also used in DATA_ENCRYPTION_KEYS p1; every place needs its own key ' +
        '(PUBLIC_BASE_URL is not a local address)',
    ]);
  });
});

describe('[AUTH-001] a reachable address is held to the https rules in every mode', () => {
  it('[AUTH-001] plain http is refused for the public address, Feide, Canvas and the files origin', () => {
    // Act
    const problems = problemsAt(
      reachable({
        PUBLIC_BASE_URL: 'http://interaktiv-test.hvl.no',
        FEIDE_ISSUER: 'http://auth.dataporten.no',
        CANVAS_ORIGINS: 'http://canvas.example',
        FILES_BASE_URL: 'http://files.example',
      }),
    );
    // Assert
    const where = 'must use https when PUBLIC_BASE_URL is not a local address';
    expect(problems).toEqual([
      `PUBLIC_BASE_URL: ${where}`,
      `FEIDE_ISSUER: ${where}`,
      `CANVAS_ORIGINS entry 1: ${where}`,
      `FILES_BASE_URL: ${where}`,
    ]);
  });

  it('[AUTH-001] a local address keeps its http mocks', () => {
    const local = {
      ...VALID_ENV,
      FEIDE_ISSUER: 'http://localhost:4200',
      CANVAS_ORIGINS: 'http://localhost:4100',
    };
    expect(problemsAt({ ...local, PUBLIC_BASE_URL: 'http://tool.localhost:3000' })).toEqual([]);
  });
});
