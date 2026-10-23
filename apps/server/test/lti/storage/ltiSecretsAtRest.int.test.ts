/**
 * Integration tests for the secrets ltijs stores: the tool's private key and platform access tokens are only ever
 * in the database encrypted, and access tokens are returned only until they expire.
 *
 * Spec: LTI-002
 */
import { afterAll, expect, it } from 'vitest';
import type { AccessTokenRecord } from 'ltijs';
import { DataEncryption } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { describeWithServices } from '../../support/services.js';
import { testToolKeys } from './ltiPlatformFixtures.js';
import { createLtiStorageTestbed } from './ltiStorageTestbed.js';

/** The lines of a PEM key between its BEGIN and END lines. */
const pemBody = (pem: string) => pem.split('\n').filter((line) => line !== '' && !line.startsWith('-----'));

const token = (createdAt: number): AccessTokenRecord => ({
  access_token: 'canvas-access-token-ABC123',
  token_type: 'bearer',
  expires_in: 3600,
  scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  createdAt,
});

describeWithServices('[LTI-002] LTI secrets at rest', () => {
  const bed = createLtiStorageTestbed();
  afterAll(() => bed.close());

  it('[LTI-002] the tool private key is stored only encrypted, with the current key, and read back intact', async () => {
    // Arrange
    const keys = testToolKeys();
    // Act
    const platform = await bed.createPlatform();
    const row = await bed.db.ltiPlatform.findUniqueOrThrow({ where: { id: platform.id } });
    const stored = Buffer.from(row.privateKeyEncrypted);
    // Assert: no part of the private key is in the row, but the public key is
    expect(stored.includes('PRIVATE KEY')).toBe(false);
    expect(pemBody(keys.private).filter((line) => stored.includes(line))).toEqual([]);
    expect(row.publicKey).toBe(keys.public);
    // Assert: it decrypts for its purpose only, under the ring's current key, and the storage returns it intact
    expect(bed.encryption.decrypt('lti-private-key', stored).toString('utf8')).toBe(keys.private);
    expect(() => bed.encryption.decrypt('lti-access-token', stored)).toThrow(/cannot decrypt/);
    expect(bed.encryption.isStale(stored)).toBe(false);
    expect(platform.keys).toEqual(keys);
  });

  it('[LTI-002] rotated keys are encrypted again, and an update of other fields leaves the stored key alone', async () => {
    // Arrange
    const platform = await bed.createPlatform();
    const storedKey = async () =>
      Buffer.from(
        (await bed.db.ltiPlatform.findUniqueOrThrow({ where: { id: platform.id } })).privateKeyEncrypted,
      );
    const before = await storedKey();
    const rotated = {
      public: 'rotated-public-key',
      private: '-----BEGIN PRIVATE KEY-----\nrotated\n-----END',
    };
    // Act
    await bed.storage().updatePlatformById(platform.id, { name: 'Renamed' });
    const afterRename = await storedKey();
    await bed.storage().updatePlatformById(platform.id, { keys: rotated });
    const afterRotation = await storedKey();
    // Assert
    expect(afterRename.equals(before)).toBe(true);
    expect(afterRotation.includes('rotated')).toBe(false);
    expect(bed.encryption.decrypt('lti-private-key', afterRotation).toString('utf8')).toBe(rotated.private);
    expect((await bed.storage().getPlatformById(platform.id))?.keys).toEqual(rotated);
  });

  it('[LTI-002] an access token is stored only encrypted, with its expiry as a column', async () => {
    // Arrange
    const url = bed.uniqueUrl();
    const createdAt = Date.now();
    // Act
    // WHY: ltijs's token schema is loose, so a platform's extra fields (refresh_token) reach saveAccessToken.
    const withExtra = { ...token(createdAt), refresh_token: 'r-1' } as AccessTokenRecord;
    await bed.storage().saveAccessToken(url, 'client-a', 'score', withExtra);
    const row = await bed.db.ltiAccessToken.findFirstOrThrow({ where: { platformUrl: url } });
    const stored = Buffer.from(row.tokenEncrypted);
    // Assert
    expect(stored.includes('canvas-access-token-ABC123')).toBe(false);
    expect(JSON.parse(bed.encryption.decrypt('lti-access-token', stored).toString('utf8'))).toEqual({
      access_token: 'canvas-access-token-ABC123',
      token_type: 'bearer',
      expires_in: 3600,
      scope: token(0).scope,
    });
    expect([row.createdAt.getTime(), row.expiresAt.getTime()]).toEqual([createdAt, createdAt + 3_600_000]);
  });

  it('[LTI-002] an access token is returned until it expires and never after', async () => {
    // Arrange
    const url = bed.uniqueUrl();
    const createdAt = Date.now();
    const at = (offsetMs: number) => bed.storage({ now: () => new Date(createdAt + offsetMs) });
    await bed.storage().saveAccessToken(url, 'client-a', 'score', token(createdAt));
    // Act
    const [lastMoment, expired] = [
      await at(3_600_000 - 1).getAccessToken(url, 'client-a', 'score'),
      await at(3_600_000).getAccessToken(url, 'client-a', 'score'),
    ];
    // Assert
    expect(lastMoment).toEqual(token(createdAt));
    expect(expired).toBeUndefined();
  });

  it('[LTI-002] an access token whose key has left the ring is a cache miss, not an error', async () => {
    // Arrange: written under a key that the server's ring does not hold
    const url = bed.uniqueUrl();
    const foreign = new DataEncryption(parseKeyring(`gone=${Buffer.alloc(32, 9).toString('base64')}`));
    await bed.storage({ encryption: foreign }).saveAccessToken(url, 'client-a', 'score', token(Date.now()));
    // Act
    const read = await bed.storage().getAccessToken(url, 'client-a', 'score');
    // Assert
    expect(read).toBeUndefined();
    expect(await bed.storage({ encryption: foreign }).getAccessToken(url, 'client-a', 'score')).toBeDefined();
  });
});
