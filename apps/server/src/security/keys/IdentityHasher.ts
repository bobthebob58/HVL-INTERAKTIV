/**
 * IdentityHasher — keyed hashes that link a login to its account without storing the identifier itself.
 *
 * Why: `Identity.subjectHash` must find the same account at every login for years (the learnerKey changes every
 *      academic year, D-011), and `AuthAuditEvent.ipHash` must group abuse by address without keeping the
 *      address (DATA-002, DATA-007). Both use the stable identity key ring (D-055), each with its own purpose key.
 * Spec: DATA-002, AUTH-001
 * Invariants:
 *   - hash = base64url(HMAC-SHA256(purposeKey(current), source)), stored with the current key's ID.
 *   - `candidates` lists the hash under every key of the ring, current first, so a lookup also finds rows made
 *     with an older key; the caller re-hashes such a row with the current key (D-055 rotation).
 * Collaborators: ./keyring.ts, ../../auth/identity/AccountResolver.ts, ../../auth/audit/AuthAuditRecorder.ts.
 * Tests: apps/server/test/security/keys/IdentityHasher.test.ts
 */
import { createHmac } from 'node:crypto';
import { purposeKey, type Keyring, type KeyPurpose } from './keyring.js';

/** The purposes identity hashes are made for. */
export type IdentityHashPurpose = Extract<KeyPurpose, 'identity-subject' | 'auth-audit-ip'>;

/** A keyed hash and the ID of the key that made it. */
export interface KeyedHash {
  /** ID of the ring key. */
  readonly keyId: string;
  /** base64url HMAC-SHA256, 43 characters. */
  readonly hash: string;
}

/** Computes identity hashes with the stable identity key ring. */
export class IdentityHasher {
  private readonly keys: ReadonlyMap<IdentityHashPurpose, readonly { keyId: string; key: Buffer }[]>;

  /**
   * @param ring - `IDENTITY_HASH_KEYS`.
   */
  constructor(ring: Keyring) {
    const derive = (purpose: IdentityHashPurpose) =>
      ring.keys.map((key) => ({ keyId: key.id, key: purposeKey(key, purpose) }));
    this.keys = new Map([
      ['identity-subject', derive('identity-subject')],
      ['auth-audit-ip', derive('auth-audit-ip')],
    ]);
  }

  /**
   * The hash with the current key.
   * @param purpose - What the hash is for.
   * @param source - The identifier, e.g. `feide|ola@hvl.no` or an IP address.
   * @returns The hash and the current key's ID.
   */
  hash(purpose: IdentityHashPurpose, source: string): KeyedHash {
    const [current] = this.candidates(purpose, source);
    if (!current) throw new Error('identity key ring is empty');
    return current;
  }

  /**
   * The hash under every key of the ring, current first.
   * @param purpose - What the hash is for.
   * @param source - The identifier.
   * @returns One hash per key.
   */
  candidates(purpose: IdentityHashPurpose, source: string): KeyedHash[] {
    return (this.keys.get(purpose) ?? []).map(({ keyId, key }) => ({
      keyId,
      hash: createHmac('sha256', key).update(source, 'utf8').digest('base64url'),
    }));
  }
}
