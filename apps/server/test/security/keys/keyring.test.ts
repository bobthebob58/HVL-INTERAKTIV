/**
 * Tests for key ring parsing and per-purpose key derivation.
 *
 * Spec: DATA-002, LTI-002, H5P-007
 */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { keyById, parseKeyring, purposeKey } from '../../../src/security/keys/keyring.js';

const key = (fill: number, bytes = 32) => Buffer.alloc(bytes, fill).toString('base64');
const urlSafe = (fill: number) => Buffer.alloc(32, fill).toString('base64url');

describe('[DATA-002] key ring parsing', () => {
  it('[DATA-002] reads id=base64 entries with the first as current', () => {
    // Act
    const ring = parseKeyring(` k2=${key(2)} , k1=${key(1)},`);
    // Assert
    expect(ring.current.id).toBe('k2');
    expect(ring.keys.map((k) => k.id)).toEqual(['k2', 'k1']);
    expect(ring.current.secret).toEqual(Buffer.alloc(32, 2));
  });

  it('[DATA-002] accepts base64url keys as well as base64', () => {
    expect(parseKeyring(`a=${urlSafe(0xfb)}`).current.secret).toEqual(Buffer.alloc(32, 0xfb));
  });

  it('[DATA-002] refuses short keys, bad IDs, repeated IDs, repeated keys and an empty ring', () => {
    const cases: [string, string][] = [
      [`a=${key(1, 31)}`, 'key a is shorter than 32 bytes'],
      [`a b=${key(1)}`, 'entry 1 is not "id=<base64>"'],
      [`${'x'.repeat(33)}=${key(1)}`, 'entry 1 is not "id=<base64>"'],
      [`a=${key(1)},a=${key(2)}`, 'key ID a is listed twice'],
      [`a=${key(1)},b=${key(1)}`, 'key b repeats an earlier key'],
      [key(1), 'entry 1 is not "id=<base64>"'],
      [' , ', 'no keys given'],
    ];
    for (const [raw, message] of cases) expect(() => parseKeyring(raw), raw).toThrow(message);
  });

  it('[DATA-002] never puts a key value in an error message', () => {
    // Arrange: a distinctive short key, and a distinctive key listed twice.
    const short = Buffer.from('secret-material-17').toString('base64');
    const repeated = Buffer.from('repeated-secret-material-32-byte').toString('base64');
    // Act and assert
    for (const raw of [`a=${short}`, `a=${repeated},b=${repeated}`, `a=${repeated},${short}`]) {
      expect(() => parseKeyring(raw)).toThrow();
      try {
        parseKeyring(raw);
      } catch (error) {
        expect((error as Error).message).not.toMatch(/c2VjcmV0|cmVwZWF0ZWQ|secret-material/);
      }
    }
  });

  it('[DATA-002] finds a key by ID, or nothing once it was removed', () => {
    const ring = parseKeyring(`new=${key(2)},old=${key(1)}`);
    expect(keyById(ring, 'old')?.secret).toEqual(Buffer.alloc(32, 1));
    expect(keyById(ring, 'gone')).toBeUndefined();
  });
});

describe('[LTI-002] per-purpose keys', () => {
  it('[LTI-002] derives a different 32-byte key for each purpose and each ring key', () => {
    // Arrange
    const ring = parseKeyring(`a=${key(1)},b=${key(2)}`);
    const [a, b] = ring.keys;
    if (!a || !b) throw new Error('ring incomplete');
    // Act
    const derived = [
      purposeKey(a, 'lti-private-key'),
      purposeKey(a, 'lti-access-token'),
      purposeKey(a, 'identity-subject'),
      purposeKey(b, 'lti-private-key'),
    ];
    // Assert: all distinct, none equal to the ring key, and stable.
    expect(new Set(derived.map((d) => d.toString('hex'))).size).toBe(4);
    for (const d of derived) {
      expect(d).toHaveLength(32);
      expect(d.equals(a.secret)).toBe(false);
    }
    expect(purposeKey(a, 'lti-private-key')).toEqual(derived[0]);
  });

  it('[LTI-002] is HKDF-SHA256 with an empty salt and info "hvli:<purpose>" (RFC 5869)', () => {
    // WHY: stored values must stay decryptable if the derivation code is ever rewritten.
    // Arrange: RFC 5869 by hand; with one 32-byte block, OKM = HMAC(PRK, info | 0x01).
    const ikm = Buffer.alloc(32, 1);
    const prk = createHmac('sha256', Buffer.alloc(32)).update(ikm).digest();
    const okm = createHmac('sha256', prk)
      .update('hvli:content-file-url')
      .update(Buffer.from([1]))
      .digest();
    // Act
    const derived = purposeKey(parseKeyring(`a=${key(1)}`).current, 'content-file-url');
    // Assert
    expect(derived).toEqual(okm);
  });
});
