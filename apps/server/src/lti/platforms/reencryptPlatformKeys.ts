/**
 * reencryptPlatformKeys — at start-up, encrypts every LTI platform private key that still uses an older key of
 * `DATA_ENCRYPTION_KEYS` again with the current key.
 *
 * Why: D-056 re-encrypts a value when it is next written, but a platform's key pair is written once, at
 *      registration. Without this pass an old key could never leave the ring, because some private key would still
 *      need it. Access tokens and session ID tokens expire within hours, so they need no pass.
 * Spec: LTI-002, DATA-009
 * Invariants:
 *   - Only rows whose stored value names a non-current key are touched; a second run changes nothing.
 *   - Each update is conditional on the value read, so two servers starting together cannot overwrite each other
 *     with different ciphertexts of the same key.
 *   - A value that cannot be decrypted (its key is gone) stops the start-up: the ring is misconfigured.
 *   - Only the count reaches the log, never a key.
 * Collaborators: ../storage/ltiPlatformRows.ts (the format and purpose), ../../security/keys/DataEncryption.ts,
 *   ../../server/main.ts.
 * Tests: apps/server/test/lti/platforms/reencryptPlatformKeys.int.test.ts
 */
import type { Prisma } from '../../generated/prisma/client.js';
import type { Database } from '../../infra/prismaClient.js';
import type { DataEncryption } from '../../security/keys/DataEncryption.js';

/**
 * Re-encrypts stale platform private keys with the current key.
 * @param db - The database.
 * @param encryption - `DATA_ENCRYPTION_KEYS`.
 * @param where - Which platforms; all by default (tests narrow it to their own rows).
 * @returns How many rows were re-encrypted.
 * @throws DecryptionError when a stored key cannot be decrypted with any key of the ring.
 */
export async function reencryptPlatformKeys(
  db: Database,
  encryption: DataEncryption,
  where: Prisma.LtiPlatformWhereInput = {},
): Promise<number> {
  const rows = await db.ltiPlatform.findMany({ where, select: { id: true, privateKeyEncrypted: true } });
  let changed = 0;
  for (const row of rows) {
    const stored = Buffer.from(row.privateKeyEncrypted);
    if (!encryption.isStale(stored)) continue;
    const privateKey = encryption.decrypt('lti-private-key', stored);
    const { count } = await db.ltiPlatform.updateMany({
      where: { id: row.id, privateKeyEncrypted: { equals: row.privateKeyEncrypted } },
      data: { privateKeyEncrypted: new Uint8Array(encryption.encrypt('lti-private-key', privateKey)) },
    });
    changed += count;
  }
  return changed;
}
