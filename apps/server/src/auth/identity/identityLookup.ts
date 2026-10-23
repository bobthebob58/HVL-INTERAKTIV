/**
 * identityLookup — finds the `Identity` row of a Feide ID or an LTI subject by keyed hash, the same way for every
 * caller, including while servers with different identity key rings run side by side.
 *
 * Why: D-055 rotates `IDENTITY_HASH_KEYS` in steps (the new key second, then first), so every running ring holds
 *      both keys. If a person still ends up with rows under two keys (a rotation done in one step, a restore),
 *      login, launch and account linking must all pick the same row, or a teacher's Canvas identity could be linked
 *      to an account their Feide login never reaches (S3 verification). A server whose ring lacks a key cannot see
 *      rows made with it; only the stepwise rotation prevents such second accounts.
 * Spec: DATA-002, AUTH-005
 * Invariants:
 *   - Rows are matched by every candidate hash of the ring; the row under the current key wins, else the oldest.
 *   - Read only: re-hashing is the caller's decision (./AccountResolver.ts does it at login).
 * Collaborators: ./AccountResolver.ts, ./accountLinking.ts, ../../security/keys/IdentityHasher.ts.
 * Tests: apps/server/test/auth/identity/AccountResolver.int.test.ts,
 *   apps/server/test/auth/identity/AccountResolver.test.ts,
 *   apps/server/test/auth/identity/accountLinkingGuards.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';

/**
 * The row to use when one person has rows under several keys: the one under the current key, else the oldest.
 * @param rows - Matching rows, oldest first.
 * @param currentKeyId - The ring's current key ID.
 * @returns The chosen row, or undefined when there is none.
 */
export function preferred<T extends { subjectKeyId: string }>(
  rows: readonly T[],
  currentKeyId: string | undefined,
): T | undefined {
  return rows.find((row) => row.subjectKeyId === currentKeyId) ?? rows[0];
}

/**
 * Finds the identity of a source text, with its user.
 * @param db - The database.
 * @param hasher - The identity hasher (`IDENTITY_HASH_KEYS`).
 * @param provider - Feide or LTI.
 * @param source - `feide|<feide-id>` or `lti|<iss>|<sub>` (./subjectSources.ts); hashed, never stored.
 * @returns The chosen row with its user, and the current key's hash for a re-hash.
 */
export async function findIdentity(
  db: Database,
  hasher: IdentityHasher,
  provider: 'feide' | 'lti',
  source: string,
) {
  const candidates = hasher.candidates('identity-subject', source);
  const rows = await db.identity.findMany({
    where: { provider, subjectHash: { in: candidates.map((c) => c.hash) } },
    // PRIVACY: only what callers read; never the staff name or e-mail on this per-request path (DATA-002).
    select: { id: true, userId: true, subjectKeyId: true, user: { select: { kind: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return { identity: preferred(rows, candidates[0]?.keyId), current: candidates[0] };
}
