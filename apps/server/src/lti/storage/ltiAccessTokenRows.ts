/**
 * ltiAccessTokenRows — converts between ltijs's cached platform access tokens and encrypted `LtiAccessToken` rows.
 *
 * Why: ltijs caches the OAuth2 access tokens it gets from a platform (AGS, NRPS) in the database. A token lets
 *      its holder post grades to Canvas until it expires, so it is stored encrypted (LTI-002, D-056) and its
 *      expiry is a column the cleanup job can use (D-052).
 * Spec: LTI-002
 * Invariants:
 *   - Only `access_token`, `token_type`, `expires_in` and `scope` are kept, as encrypted JSON (purpose
 *     `lti-access-token`, always the current key); `createdAt` and `expiresAt` are plain columns.
 *   - `expiresAt = createdAt + expires_in` seconds.
 *   - A stored value that cannot be decrypted or parsed reads as a cache miss: ltijs then fetches a new token.
 * Collaborators: ./PrismaLtiDatabaseManager.ts, ../../security/keys/DataEncryption.ts.
 * Tests: apps/server/test/lti/storage/ltiStorageRows.test.ts, apps/server/test/lti/storage/ltiSecretsAtRest.int.test.ts
 */
import type { AccessTokenRecord } from 'ltijs';
import type { LtiAccessToken } from '../../generated/prisma/client.js';
import type { DataEncryption } from '../../security/keys/DataEncryption.js';

/** The token fields that are encrypted together. */
type StoredToken = Omit<AccessTokenRecord, 'createdAt'>;

const isStoredToken = (value: unknown): value is StoredToken => {
  const token = value as Partial<StoredToken> | null;
  return (
    typeof token?.access_token === 'string' &&
    typeof token.token_type === 'string' &&
    typeof token.expires_in === 'number' &&
    (token.scope === undefined || typeof token.scope === 'string')
  );
};

/**
 * Builds the columns that hold one access token.
 * @param token - The token ltijs caches, with its `createdAt` in milliseconds.
 * @param encryption - `DATA_ENCRYPTION_KEYS`.
 * @returns The encrypted token and its creation and expiry times.
 */
export function accessTokenColumns(
  token: AccessTokenRecord,
  encryption: DataEncryption,
): Pick<LtiAccessToken, 'tokenEncrypted' | 'createdAt' | 'expiresAt'> {
  const stored: StoredToken = {
    access_token: token.access_token,
    token_type: token.token_type,
    expires_in: token.expires_in,
    ...(token.scope !== undefined && { scope: token.scope }),
  };
  return {
    // SECURITY: a platform access token can post grades until it expires; a database dump must not reveal it (LTI-002, D-056).
    tokenEncrypted: new Uint8Array(encryption.encrypt('lti-access-token', JSON.stringify(stored))),
    createdAt: new Date(token.createdAt),
    expiresAt: new Date(token.createdAt + token.expires_in * 1000),
  };
}

/**
 * Reads the access token of a row.
 * @param row - The stored row.
 * @param encryption - `DATA_ENCRYPTION_KEYS`.
 * @returns The token as ltijs cached it, or undefined when the stored value is unreadable.
 */
export function accessTokenFromRow(
  row: Pick<LtiAccessToken, 'tokenEncrypted' | 'createdAt'>,
  encryption: DataEncryption,
): AccessTokenRecord | undefined {
  try {
    const text = encryption.decrypt('lti-access-token', Buffer.from(row.tokenEncrypted)).toString('utf8');
    const token: unknown = JSON.parse(text);
    if (!isStoredToken(token)) return undefined;
    return { ...token, createdAt: row.createdAt.getTime() };
  } catch {
    // WHY: an unreadable cached token (e.g. its key was removed from the ring) is only a miss; ltijs asks again.
    return undefined;
  }
}
