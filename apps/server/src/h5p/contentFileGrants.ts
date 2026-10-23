/**
 * contentFileGrants — signs and checks the grant in a content-file URL (`/h5p/files/<grant>/<contentId>/<file>`).
 *
 * Why: H5P builds an activity's file URLs as `contentUrl + "/" + path`, so neither a session cookie (blocked in a
 *      Canvas iframe) nor a query token can authorise them (D-058). The player render, which has passed the
 *      View check, puts a grant into `contentUrl` instead: an HMAC over the activity ID and an expiry, valid for
 *      about 12 hours, which the public file route checks before it reads storage (D-045 moved signed URLs here).
 * Spec: H5P-007, SEC-004
 * Invariants:
 *   - Format `<keyId>.<expirySeconds>.<base64url HMAC-SHA256(purpose key, "<contentId>|<expirySeconds>")>`, where
 *     the purpose key is HKDF `content-file-url` of a `URL_SIGNING_KEYS` ring key (../security/keys/keyring.ts).
 *   - New grants use the ring's current key; a grant made with an older key stays valid until that key is removed.
 *   - The expiry is the issue time rounded up to a whole hour, plus 12 hours, so a file URL stays the same for an
 *     hour and browsers can cache the files.
 *   - Verification accepts only the canonical form, compares signatures in constant time, and refuses a removed
 *     key, an expired grant (expiry ≤ now), an expiry further ahead than any grant this code issues, and a grant
 *     for another activity.
 *   - A grant names no person and carries no token; logs redact it (../logging/redactText.ts).
 * Collaborators: ../security/keys/keyring.ts, ./HvlUrlGenerator.ts, ../http/routes/signedFileRoutes.ts,
 *   ./createH5pRuntime.ts.
 * Tests: apps/server/test/h5p/contentFileGrants.test.ts, apps/server/test/http/signedFiles.int.test.ts
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { purposeKey, type Keyring } from '../security/keys/keyring.js';

const HOUR_SECONDS = 3600;

/** How long a grant stays valid after the end of the hour it was issued in: 12 hours (D-058). */
export const GRANT_LIFETIME_SECONDS = 12 * HOUR_SECONDS;

/** Clock difference between server nodes that verification tolerates. */
export const GRANT_CLOCK_SKEW_SECONDS = 5 * 60;

// WHY: the latest expiry this code issues is now + 1 h (rounding) + 12 h; anything later was not made by us.
const MAX_AHEAD_SECONDS = HOUR_SECONDS + GRANT_LIFETIME_SECONDS + GRANT_CLOCK_SKEW_SECONDS;

// SECURITY: one canonical spelling only. A base64url HMAC-SHA256 is exactly 43 characters; the key ID follows
// the ring's ID rule; the expiry has no sign, no leading zero and at most 12 digits.
const GRANT_PATTERN = /^([A-Za-z0-9_-]{1,32})\.([1-9][0-9]{0,11})\.([A-Za-z0-9_-]{43})$/;

/** Why a grant was refused. The route answers every reason the same way; tests read it. */
export type GrantRejection = 'malformed' | 'unknown-key' | 'expired' | 'too-far-ahead' | 'wrong-signature';

/** The result of checking a grant. */
export type GrantCheck =
  | { readonly valid: true; readonly expiresAt: number }
  | { readonly valid: false; readonly reason: GrantRejection };

const toSeconds = (at: Date): number => Math.floor(at.getTime() / 1000);

/** Issues and verifies content-file grants with the `URL_SIGNING_KEYS` ring. */
export class ContentFileGrants {
  private readonly keys: ReadonlyMap<string, Buffer>;
  private readonly currentKeyId: string;

  /**
   * @param ring - `URL_SIGNING_KEYS`; the first key signs, every key verifies.
   */
  constructor(ring: Keyring) {
    this.keys = new Map(ring.keys.map((key) => [key.id, purposeKey(key, 'content-file-url')]));
    this.currentKeyId = ring.current.id;
  }

  /**
   * Issues a grant for the files of one activity. Call only after the View check for that activity.
   * @param contentId - The activity ID, exactly as it appears in the file URL.
   * @param now - The issue time.
   * @returns The grant, safe to put into a URL path segment as it is.
   */
  issueGrant(contentId: string, now: Date): string {
    const expiry = Math.ceil(toSeconds(now) / HOUR_SECONDS) * HOUR_SECONDS + GRANT_LIFETIME_SECONDS;
    return `${this.currentKeyId}.${expiry}.${this.sign(this.currentKeyId, contentId, expiry)}`;
  }

  /**
   * Checks a grant from a file URL.
   * @param grant - The grant path segment.
   * @param contentId - The activity ID from the same URL.
   * @param now - The time of the request.
   * @returns `valid` with the expiry (Unix seconds), or the reason for the refusal.
   */
  verifyGrant(grant: string, contentId: string, now: Date): GrantCheck {
    const match = GRANT_PATTERN.exec(grant);
    if (!match) return { valid: false, reason: 'malformed' };
    const [, keyId = '', expiryText = '', signature = ''] = match;
    if (!this.keys.has(keyId)) return { valid: false, reason: 'unknown-key' };
    const expiry = Number(expiryText);
    const nowSeconds = toSeconds(now);
    if (expiry <= nowSeconds) return { valid: false, reason: 'expired' };
    if (expiry > nowSeconds + MAX_AHEAD_SECONDS) return { valid: false, reason: 'too-far-ahead' };
    const expected = Buffer.from(this.sign(keyId, contentId, expiry), 'ascii');
    // SECURITY: both sides are 43 ASCII characters here, so the comparison takes the same time for any input.
    if (!timingSafeEqual(Buffer.from(signature, 'ascii'), expected)) {
      return { valid: false, reason: 'wrong-signature' };
    }
    return { valid: true, expiresAt: expiry };
  }

  private sign(keyId: string, contentId: string, expiry: number): string {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`URL signing key ${keyId} is not in the ring`);
    return createHmac('sha256', key).update(`${contentId}|${expiry}`, 'utf8').digest('base64url');
  }
}
