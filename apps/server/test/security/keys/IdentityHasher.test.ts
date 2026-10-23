/**
 * Tests for the stable identity hashes and their key rotation (D-055).
 *
 * Spec: DATA-002, AUTH-001
 */
import { describe, expect, it } from 'vitest';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');
const SOURCE = 'feide|ola.nordmann@hvl.no';

describe('[DATA-002] identity hashes', () => {
  it('[DATA-002] gives a stable 43-character base64url hash with the current key ID, never the source', () => {
    // Arrange
    const hasher = new IdentityHasher(parseKeyring(`k1=${key(1)}`));
    // Act
    const first = hasher.hash('identity-subject', SOURCE);
    // Assert
    expect(first).toEqual(hasher.hash('identity-subject', SOURCE));
    expect(first.keyId).toBe('k1');
    expect(first.hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.hash).not.toContain('ola');
  });

  it('[DATA-002] keeps purposes apart: a subject hash never equals an IP hash of the same text', () => {
    const hasher = new IdentityHasher(parseKeyring(`k1=${key(1)}`));
    expect(hasher.hash('identity-subject', '10.0.0.1').hash).not.toBe(
      hasher.hash('auth-audit-ip', '10.0.0.1').hash,
    );
  });

  it('[DATA-002] differs per source and per key', () => {
    const one = new IdentityHasher(parseKeyring(`k1=${key(1)}`));
    const two = new IdentityHasher(parseKeyring(`k2=${key(2)}`));
    expect(one.hash('identity-subject', SOURCE).hash).not.toBe(
      one.hash('identity-subject', `${SOURCE}x`).hash,
    );
    expect(one.hash('identity-subject', SOURCE).hash).not.toBe(two.hash('identity-subject', SOURCE).hash);
  });

  it('[DATA-002] after rotation, finds a row hashed with the old key and offers the current hash to re-store', () => {
    // Arrange: a row stored before rotation.
    const before = new IdentityHasher(parseKeyring(`old=${key(1)}`));
    const stored = before.hash('identity-subject', SOURCE);
    // Act: the new key is put first.
    const after = new IdentityHasher(parseKeyring(`new=${key(2)},old=${key(1)}`));
    const candidates = after.candidates('identity-subject', SOURCE);
    // Assert: current first, and the old row is among the candidates.
    expect(candidates.map((c) => c.keyId)).toEqual(['new', 'old']);
    expect(candidates).toContainEqual(stored);
    expect(after.hash('identity-subject', SOURCE)).toEqual(candidates[0]);
    expect(candidates[0]?.hash).not.toBe(stored.hash);
  });
});
