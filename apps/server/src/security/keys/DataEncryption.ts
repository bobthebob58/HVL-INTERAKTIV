/**
 * DataEncryption — encrypts secrets the server must store: LTI tool private keys, platform access tokens, the
 * Feide ID token in a portal session, and (S6) the LTI subject a grade sync needs.
 *
 * Why: `LTI-002` requires platform private keys encrypted at rest, and D-021 the Feide ID token. A database or
 *      Redis dump alone must reveal no key or token (D-056).
 * Spec: LTI-002, AUTH-003
 * Invariants:
 *   - AES-256-GCM with a 12-byte random IV; the key is the ring key's purpose key, and the purpose is also the
 *     additional authenticated data, so a value encrypted for one purpose never decrypts as another.
 *   - Format: `0x01 | keyIdLength | keyId (ASCII) | iv (12) | tag (16) | ciphertext`.
 *   - Decryption fails closed: an unknown version, an unknown key ID, a short blob or a wrong tag throws.
 *   - Errors never contain key material or plaintext.
 * Collaborators: ./keyring.ts, ../../lti/storage/ltiPlatformRows.ts, ../../auth/session/SessionStore.ts.
 * Tests: apps/server/test/security/keys/DataEncryption.test.ts
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { keyById, purposeKey, type Keyring, type KeyPurpose } from './keyring.js';

const VERSION = 0x01;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Thrown when a stored value cannot be decrypted. */
export class DecryptionError extends Error {
  /**
   * @param reason - What is wrong, without any secret.
   */
  constructor(reason: string) {
    super(`cannot decrypt: ${reason}`);
    this.name = 'DecryptionError';
  }
}

/** Encrypts and decrypts with `DATA_ENCRYPTION_KEYS`. */
export class DataEncryption {
  /**
   * @param ring - `DATA_ENCRYPTION_KEYS`.
   */
  constructor(private readonly ring: Keyring) {}

  /**
   * Encrypts with the current key.
   * @param purpose - What the value is.
   * @param plaintext - The secret.
   * @returns The stored form.
   */
  encrypt(purpose: KeyPurpose, plaintext: Buffer | string): Buffer {
    const keyId = Buffer.from(this.ring.current.id, 'ascii');
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', purposeKey(this.ring.current, purpose), iv);
    cipher.setAAD(Buffer.from(purpose, 'utf8'));
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION, keyId.length]), keyId, iv, cipher.getAuthTag(), body]);
  }

  /**
   * Decrypts a stored value.
   * @param purpose - The purpose it was encrypted for.
   * @param stored - The stored form.
   * @returns The plaintext.
   * @throws DecryptionError when the value is malformed, its key is gone, or it was changed.
   */
  decrypt(purpose: KeyPurpose, stored: Buffer): Buffer {
    const { keyId, iv, tag, body } = this.split(stored);
    const key = keyById(this.ring, keyId);
    if (!key) throw new DecryptionError(`key ${keyId} is not in the ring`);
    const decipher = createDecipheriv('aes-256-gcm', purposeKey(key, purpose), iv);
    decipher.setAAD(Buffer.from(purpose, 'utf8'));
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(body), decipher.final()]);
    } catch {
      throw new DecryptionError('the value was changed or belongs to another purpose');
    }
  }

  /**
   * Tells whether a stored value uses an older key and should be encrypted again when next written.
   * @param stored - The stored form.
   * @returns True when its key is not the current key.
   */
  isStale(stored: Buffer): boolean {
    return this.split(stored).keyId !== this.ring.current.id;
  }

  private split(stored: Buffer): { keyId: string; iv: Buffer; tag: Buffer; body: Buffer } {
    if (stored.length < 2 || stored[0] !== VERSION) throw new DecryptionError('unknown format');
    const idLength = stored[1] ?? 0;
    const ivStart = 2 + idLength;
    const tagStart = ivStart + IV_BYTES;
    const bodyStart = tagStart + TAG_BYTES;
    if (stored.length < bodyStart) throw new DecryptionError('value too short');
    return {
      keyId: stored.subarray(2, ivStart).toString('ascii'),
      iv: stored.subarray(ivStart, tagStart),
      tag: stored.subarray(tagStart, bodyStart),
      body: stored.subarray(bodyStart),
    };
  }
}
