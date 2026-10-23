/**
 * opaqueIds — random bearer values (session IDs, login-transaction IDs, CSRF tokens) and the digest that names
 * their Redis keys.
 *
 * Why: the session cookie, the login-transaction cookie and the CSRF token are bearer secrets. They need 256 bits
 *      of randomness, one fixed format that every reader can check before touching Redis, and a Redis key that
 *      does not contain the value itself, so a Redis dump or `MONITOR` output never holds a usable cookie (D-057).
 * Spec: AUTH-003, AUTH-001
 * Invariants:
 *   - A value is 32 bytes from `node:crypto` `randomBytes`, base64url without padding (43 characters).
 *   - `isOpaqueId` accepts exactly that shape, so oversized or foreign values are refused before any lookup.
 *   - A Redis key holds `base64url(SHA-256(value))`, never the value.
 * Collaborators: ./SessionStore.ts, ./csrfToken.ts, ./sessionCookies.ts, ../feide/loginTransactions.ts.
 * Tests: apps/server/test/auth/session/SessionStore.int.test.ts,
 *   apps/server/test/auth/session/SessionStore.integrity.int.test.ts,
 *   apps/server/test/auth/feide/loginTransactions.int.test.ts
 */
import { createHash, randomBytes } from 'node:crypto';

/** Random bytes in every opaque value (256 bits). */
export const OPAQUE_ID_BYTES = 32;

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Makes a new random bearer value.
 * @returns 43 base64url characters.
 */
export const newOpaqueId = (): string => randomBytes(OPAQUE_ID_BYTES).toString('base64url');

/**
 * Tells whether a value has the shape `newOpaqueId` produces.
 * @param value - A value from a cookie or another untrusted source.
 * @returns True for exactly 43 base64url characters.
 */
export const isOpaqueId = (value: unknown): value is string =>
  typeof value === 'string' && OPAQUE_ID_PATTERN.test(value);

/**
 * The Redis key for a bearer value.
 * @param prefix - Key namespace, e.g. `hvli:sess:`.
 * @param value - The bearer value.
 * @returns `<prefix><base64url SHA-256(value)>`.
 */
export const opaqueIdKey = (prefix: string, value: string): string =>
  // SECURITY: only the digest is stored, so a Redis dump, backup or `KEYS` listing never yields a usable cookie.
  `${prefix}${createHash('sha256').update(value, 'utf8').digest('base64url')}`;
