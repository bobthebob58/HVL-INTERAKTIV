/**
 * keyring — parses a key ring (`id=base64,…`) and derives one key per purpose from each of its keys.
 *
 * Why: identity hashes, encrypted secrets and signed URLs each need a server key that can be rotated without
 *      downtime (D-055, D-056, D-058). A ring holds the current key first and older keys after it, so old
 *      values can still be checked or decrypted while new ones use the current key. HKDF gives every purpose
 *      its own key, so one leaked purpose key reveals nothing about another.
 * Spec: DATA-002, LTI-002, AUTH-003, H5P-007
 * Invariants:
 *   - Format `id=<base64>,id=<base64>`; the first entry is current. An ID is 1–32 characters of `[A-Za-z0-9_-]`.
 *   - Every key decodes to at least 32 bytes; IDs and keys are unique within a ring.
 *   - Purpose keys are HKDF-SHA256(key, salt = empty, info = `hvli:<purpose>`), 32 bytes.
 *   - Errors name the entry by position or ID, never by value.
 * Collaborators: ../../config/env.ts, ./IdentityHasher.ts, ./DataEncryption.ts, ../../h5p/contentFileGrants.ts.
 * Tests: apps/server/test/security/keys/keyring.test.ts
 */
import { hkdfSync } from 'node:crypto';

/** Fewest bytes a key in a ring may have. */
export const MIN_KEY_BYTES = 32;

/** One key of a ring. */
export interface RingKey {
  /** The key's ID, stored next to every value it produced. */
  readonly id: string;
  /** The key material. */
  readonly secret: Buffer;
}

/** A parsed key ring. */
export interface Keyring {
  /** The key new values use (the first entry). */
  readonly current: RingKey;
  /** Every key, current first. */
  readonly keys: readonly RingKey[];
}

/** What a derived key is for; part of the HKDF info, so purposes never share a key. */
export type KeyPurpose =
  | 'identity-subject'
  | 'auth-audit-ip'
  | 'lti-private-key'
  | 'lti-access-token'
  | 'session-id-token'
  | 'grade-lti-sub'
  | 'content-file-url'
  | 'temporary-file-url';

/**
 * Parses a key ring.
 * @param raw - Comma-separated `id=base64` pairs; the first is current.
 * @returns The ring.
 * @throws Error naming the faulty entry by position or ID.
 */
export function parseKeyring(raw: string): Keyring {
  const keys: RingKey[] = [];
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .forEach((part, index) => {
      const match = /^([A-Za-z0-9_-]{1,32})=([A-Za-z0-9+/_-]+={0,2})$/.exec(part);
      if (!match) throw new Error(`entry ${index + 1} is not "id=<base64>"`);
      const id = match[1] ?? '';
      // SECURITY: the value is decoded but never included in any message.
      const secret = Buffer.from(match[2] ?? '', 'base64');
      if (secret.length < MIN_KEY_BYTES) throw new Error(`key ${id} is shorter than ${MIN_KEY_BYTES} bytes`);
      if (keys.some((key) => key.id === id)) throw new Error(`key ID ${id} is listed twice`);
      if (keys.some((key) => key.secret.equals(secret))) throw new Error(`key ${id} repeats an earlier key`);
      keys.push({ id, secret });
    });
  const current = keys[0];
  if (!current) throw new Error('no keys given');
  return { current, keys };
}

/**
 * Derives the key for one purpose from a ring key.
 * @param key - A key of the ring.
 * @param purpose - What the derived key is used for.
 * @returns 32 bytes.
 */
export function purposeKey(key: RingKey, purpose: KeyPurpose): Buffer {
  return Buffer.from(hkdfSync('sha256', key.secret, Buffer.alloc(0), `hvli:${purpose}`, 32));
}

/**
 * Finds a key by ID.
 * @param ring - The ring.
 * @param id - The ID stored with a value.
 * @returns The key, or undefined when it has been removed from the ring.
 */
export function keyById(ring: Keyring, id: string): RingKey | undefined {
  return ring.keys.find((key) => key.id === id);
}
