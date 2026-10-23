/**
 * Tests for encryption of secrets at rest: round trip, tampering, purpose binding and key rotation (D-056).
 *
 * Spec: LTI-002, AUTH-003
 */
import { describe, expect, it } from 'vitest';
import { DataEncryption, DecryptionError } from '../../../src/security/keys/DataEncryption.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIE…\n-----END PRIVATE KEY-----';
const encryption = (raw = `k1=${key(1)}`) => new DataEncryption(parseKeyring(raw));

describe('[LTI-002] encryption at rest', () => {
  it('[LTI-002] round-trips, and the stored form contains neither the plaintext nor the key', () => {
    // Arrange
    const crypto = encryption();
    // Act
    const stored = crypto.encrypt('lti-private-key', PRIVATE_KEY);
    // Assert
    expect(crypto.decrypt('lti-private-key', stored).toString('utf8')).toBe(PRIVATE_KEY);
    expect(stored.includes(Buffer.from('PRIVATE KEY'))).toBe(false);
    expect(stored.includes(Buffer.alloc(32, 1))).toBe(false);
    expect(stored.subarray(0, 4)).toEqual(Buffer.from([0x01, 2, ...Buffer.from('k1')]));
  });

  it('[LTI-002] uses a fresh IV, so the same secret never encrypts to the same bytes twice', () => {
    const crypto = encryption();
    expect(crypto.encrypt('lti-access-token', 'tok').equals(crypto.encrypt('lti-access-token', 'tok'))).toBe(
      false,
    );
  });

  it('[LTI-002] refuses any changed byte, a truncated value and an unknown format', () => {
    // Arrange
    const crypto = encryption();
    const stored = crypto.encrypt('lti-private-key', PRIVATE_KEY);
    // Act and assert: flipping any byte after the key ID breaks the tag check.
    for (let i = 4; i < stored.length; i += 1) {
      const changed = Buffer.from(stored);
      changed[i] = (changed[i] ?? 0) ^ 0x01;
      expect(() => crypto.decrypt('lti-private-key', changed), `byte ${i}`).toThrow(DecryptionError);
    }
    expect(() => crypto.decrypt('lti-private-key', stored.subarray(0, 20))).toThrow('value too short');
    expect(() => crypto.decrypt('lti-private-key', Buffer.from([0x02, 0]))).toThrow('unknown format');
    expect(() => crypto.decrypt('lti-private-key', Buffer.alloc(0))).toThrow('unknown format');
  });

  it('[LTI-002] binds a value to its purpose: a token encrypted for one use never decrypts as another', () => {
    const crypto = encryption();
    const stored = crypto.encrypt('session-id-token', 'eyJ…');
    expect(() => crypto.decrypt('lti-access-token', stored)).toThrow(
      'cannot decrypt: the value was changed or belongs to another purpose',
    );
  });

  it('[LTI-002] decrypts values made with an older key, marks them stale, and fails once the key is removed', () => {
    // Arrange
    const stored = encryption(`old=${key(1)}`).encrypt('lti-private-key', PRIVATE_KEY);
    const rotated = encryption(`new=${key(2)},old=${key(1)}`);
    // Act and assert: still readable and marked for re-encryption.
    expect(rotated.decrypt('lti-private-key', stored).toString('utf8')).toBe(PRIVATE_KEY);
    expect(rotated.isStale(stored)).toBe(true);
    expect(rotated.isStale(rotated.encrypt('lti-private-key', PRIVATE_KEY))).toBe(false);
    // Act and assert: after the old key is removed the value is gone, and the error names only the key ID.
    expect(() => encryption(`new=${key(2)}`).decrypt('lti-private-key', stored)).toThrow(
      'cannot decrypt: key old is not in the ring',
    );
  });

  it('[AUTH-003] keeps a swapped key ID from decrypting with another key', () => {
    // Arrange: a value made with key "aa", relabelled as made with key "bb".
    const crypto = encryption(`aa=${key(1)},bb=${key(2)}`);
    const stored = crypto.encrypt('session-id-token', 'eyJ…');
    const relabelled = Buffer.from(stored);
    relabelled.write('bb', 2, 'ascii');
    // Act and assert
    expect(() => crypto.decrypt('session-id-token', relabelled)).toThrow(DecryptionError);
  });
});
