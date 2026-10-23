/**
 * ltiPlatformFixtures — the attributes of a Canvas-like LTI platform with a real tool key pair, for storage tests.
 *
 * Why: the storage contract, the PostgreSQL tests and the ltijs round trip all save platforms. The key pair must
 *      be real, because ltijs signs ltiks, Deep Linking responses and client assertions with it.
 * Spec: LTI-002
 * Invariants: the RSA key pair (2048 bits, SPKI and PKCS#1 PEM, as ltijs generates) is made once per test file.
 * Collaborators: ./ltiDatabaseContract.ts, ./ltiStorageTestbed.ts.
 * Tests: apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts,
 *   apps/server/test/lti/storage/ltiSecretsAtRest.int.test.ts
 */
import { generateKeyPairSync } from 'node:crypto';
import { IdTokenValidationMethod } from 'ltijs';
import type { PlatformAttributes, PlatformKeys } from 'ltijs';

let toolKeys: PlatformKeys | undefined;

/**
 * A real RSA key pair in PEM, as ltijs generates for a platform.
 * @returns The tool's public and private key; the same pair for the whole test file.
 */
export function testToolKeys(): PlatformKeys {
  toolKeys ??= (() => {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    return { public: pair.publicKey, private: pair.privateKey };
  })();
  return toolKeys;
}

/**
 * The attributes of a Canvas-like platform at a URL.
 * @param url - The issuer, normally a unique test URL.
 * @param overrides - Fields to change.
 * @returns Attributes ready for `savePlatform`.
 */
export const platformAttributes = (
  url: string,
  overrides: Partial<PlatformAttributes> = {},
): PlatformAttributes => ({
  url,
  clientId: 'client-a',
  name: 'Test Canvas',
  authenticationEndpoint: `${url}/api/lti/authorize_redirect`,
  accessTokenEndpoint: `${url}/login/oauth2/token`,
  idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: `${url}/api/lti/security/jwks` },
  active: true,
  keys: testToolKeys(),
  ...overrides,
});
