/**
 * Unit tests for the row mappers of ltijs's storage: platform keys encrypted with the current key and re-encrypted
 * on every write, partial updates, filters, and access tokens reduced to the four fields ltijs caches.
 *
 * Spec: LTI-002
 */
import { IdTokenValidationMethod, type PlatformKeys } from 'ltijs';
import { describe, expect, it } from 'vitest';
import type { LtiPlatform } from '../../../src/generated/prisma/client.js';
import { accessTokenColumns, accessTokenFromRow } from '../../../src/lti/storage/ltiAccessTokenRows.js';
import {
  isPlatformId,
  platformCreateData,
  platformFromRow,
} from '../../../src/lti/storage/ltiPlatformRows.js';
import { platformUpdateData, platformWhere } from '../../../src/lti/storage/ltiPlatformRows.js';
import { DataEncryption, DecryptionError } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const OLD = new DataEncryption(parseKeyring(`old=${key(1)}`));
const ROTATED = new DataEncryption(parseKeyring(`new=${key(2)},old=${key(1)}`));
const KEYS: PlatformKeys = { public: 'PUBLIC-PEM', private: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END' };
const keyIdOf = (stored: Uint8Array) =>
  Buffer.from(stored.subarray(2, 2 + (stored[1] ?? 0))).toString('ascii');
const ATTRIBUTES = {
  url: 'https://canvas.example.test',
  clientId: 'client-a',
  name: 'Canvas',
  authenticationEndpoint: 'https://sso.example.test/auth',
  accessTokenEndpoint: 'https://sso.example.test/token',
  idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: 'https://sso.example.test/jwks' },
  active: true,
  keys: KEYS,
};

/** A stored row as Prisma returns it, made from the create input. */
const rowOf = (encryption: DataEncryption): LtiPlatform => {
  const data = platformCreateData(ATTRIBUTES, encryption);
  return {
    ...data,
    id: '0192f0c4-2222-7000-8000-000000000001',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as LtiPlatform;
};

describe('[LTI-002] platform rows', () => {
  it('[LTI-002] a new row holds the private key only encrypted with the current key', () => {
    // Act
    const data = platformCreateData(ATTRIBUTES, ROTATED);
    // Assert
    expect(Buffer.from(data.privateKeyEncrypted as Uint8Array).includes('secret')).toBe(false);
    expect(keyIdOf(data.privateKeyEncrypted as Uint8Array)).toBe('new');
    expect(data).toMatchObject({
      publicKey: 'PUBLIC-PEM',
      idTokenValidationMethod: 'JWK_SET',
      authorizationServer: null,
    });
    expect(data).not.toHaveProperty('keys');
  });

  it('[LTI-002] a row written under an older key is read while that key is in the ring, never after', () => {
    // Arrange
    const row = rowOf(OLD);
    // Act and assert
    expect(platformFromRow(row, ROTATED)).toMatchObject({
      id: row.id,
      keys: KEYS,
      idTokenValidation: ATTRIBUTES.idTokenValidation,
    });
    expect(platformFromRow(row, ROTATED)).not.toHaveProperty('authorizationServer');
    expect(() => platformFromRow(row, new DataEncryption(parseKeyring(`new=${key(2)}`)))).toThrow(
      DecryptionError,
    );
  });

  it('[LTI-002] refuses a row whose ID-token validation method ltijs does not know', () => {
    expect(() => platformFromRow({ ...rowOf(OLD), idTokenValidationMethod: 'NONE' }, OLD)).toThrow(
      /unknown ID-token/,
    );
  });

  it('[LTI-002] an update writes only the given fields and re-encrypts keys with the current key', () => {
    // Act
    const rename = platformUpdateData({ name: 'Renamed', active: false, url: undefined }, ROTATED);
    const method = platformUpdateData(
      { idTokenValidation: { method: IdTokenValidationMethod.RsaKey } as never },
      ROTATED,
    );
    const rotation = platformUpdateData(
      { keys: KEYS, authorizationServer: 'https://as.example.test' },
      ROTATED,
    );
    // Assert
    expect(rename).toEqual({ name: 'Renamed', active: false });
    expect(method).toEqual({ idTokenValidationMethod: 'RSA_KEY' });
    expect(Object.keys(rotation).sort()).toEqual(['authorizationServer', 'privateKeyEncrypted', 'publicKey']);
    expect(keyIdOf(rotation.privateKeyEncrypted as Uint8Array)).toBe('new');
    expect(
      ROTATED.decrypt('lti-private-key', Buffer.from(rotation.privateKeyEncrypted as Uint8Array)).toString(),
    ).toBe(KEYS.private);
  });

  it('[LTI-002] filters by URL, name and one or several client IDs; no filter matches every platform', () => {
    expect(platformWhere()).toEqual({});
    expect(platformWhere({ url: 'u', name: 'n', clientId: 'c' })).toEqual({
      url: 'u',
      name: 'n',
      clientId: 'c',
    });
    expect(platformWhere({ clientId: ['a', 'b'] })).toEqual({ clientId: { in: ['a', 'b'] } });
  });

  it('[LTI-002] only a canonical UUID can be a platform ID', () => {
    expect(isPlatformId('0192f0c4-2222-7000-8000-000000000001')).toBe(true);
    for (const id of [
      '',
      'abc',
      '0192f0c4-2222-7000-8000-00000000000',
      ' 0192f0c4-2222-7000-8000-000000000001',
      7,
    ]) {
      expect(isPlatformId(id)).toBe(false);
    }
  });
});

describe('[LTI-002] access token rows', () => {
  const TOKEN = {
    access_token: 'tok',
    token_type: 'bearer',
    expires_in: 60,
    scope: 's',
    createdAt: 1_000_000,
  };

  it('[LTI-002] keeps only the four token fields, encrypted, and derives the expiry from expires_in', () => {
    // Act
    const columns = accessTokenColumns(
      { ...TOKEN, id_token: 'Kari', refresh_token: 'r' } as typeof TOKEN,
      ROTATED,
    );
    // Assert
    expect(
      JSON.parse(ROTATED.decrypt('lti-access-token', Buffer.from(columns.tokenEncrypted)).toString()),
    ).toEqual({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 60,
      scope: 's',
    });
    expect(keyIdOf(columns.tokenEncrypted)).toBe('new');
    expect([columns.createdAt.getTime(), columns.expiresAt.getTime()]).toEqual([1_000_000, 1_060_000]);
    expect(accessTokenFromRow(columns, ROTATED)).toEqual(TOKEN);
  });

  it('[LTI-002] reads an unreadable or malformed stored token as a miss', () => {
    // Arrange
    const createdAt = new Date(0);
    const encrypt = (value: unknown) =>
      new Uint8Array(OLD.encrypt('lti-access-token', JSON.stringify(value)));
    // Act and assert
    expect(accessTokenFromRow({ tokenEncrypted: encrypt(TOKEN), createdAt }, ROTATED)).toBeDefined();
    expect(
      accessTokenFromRow(
        { tokenEncrypted: encrypt(TOKEN), createdAt },
        new DataEncryption(parseKeyring(`x=${key(3)}`)),
      ),
    ).toBeUndefined();
    expect(
      accessTokenFromRow({ tokenEncrypted: encrypt({ access_token: 1 }), createdAt }, OLD),
    ).toBeUndefined();
    expect(accessTokenFromRow({ tokenEncrypted: new Uint8Array([1, 2, 3]), createdAt }, OLD)).toBeUndefined();
  });
});
