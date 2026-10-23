/**
 * Integration tests for re-encrypting LTI platform private keys after a `DATA_ENCRYPTION_KEYS` rotation, so the
 * old key can leave the ring (D-056).
 *
 * Spec: LTI-002
 */
import { afterAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { reencryptPlatformKeys } from '../../../src/lti/platforms/reencryptPlatformKeys.js';
import { DataEncryption } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----';

describeWithServices('[LTI-002] platform private keys after a key rotation', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const url = `https://${uniqueName('rotation')}.example`;
  afterAll(async () => {
    await db.ltiPlatform.deleteMany({ where: { url } });
    await db.$disconnect();
  });

  it('[LTI-002] re-encrypts a key made with the old key, so the old key can be removed; a second run changes nothing', async () => {
    // Arrange: a platform key encrypted before the rotation
    const before = new DataEncryption(parseKeyring(`old=${key(1)}`));
    const during = new DataEncryption(parseKeyring(`new=${key(2)},old=${key(1)}`));
    const after = new DataEncryption(parseKeyring(`new=${key(2)}`));
    const { id } = await db.ltiPlatform.create({
      data: {
        url,
        clientId: '1',
        name: 'Rotation',
        authenticationEndpoint: 'https://sso.example/auth',
        accessTokenEndpoint: 'https://sso.example/token',
        idTokenValidationMethod: 'JWK_SET',
        idTokenValidationKey: 'https://sso.example/jwks',
        publicKey: 'public',
        privateKeyEncrypted: new Uint8Array(before.encrypt('lti-private-key', PRIVATE_KEY)),
      },
    });
    // Act
    const first = await reencryptPlatformKeys(db, during);
    const second = await reencryptPlatformKeys(db, during);
    // Assert
    const row = await db.ltiPlatform.findUniqueOrThrow({ where: { id } });
    const stored = Buffer.from(row.privateKeyEncrypted);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0);
    expect(after.decrypt('lti-private-key', stored).toString('utf8')).toBe(PRIVATE_KEY);
    expect(stored.toString('latin1')).not.toContain('MIIfake');
  });
});
