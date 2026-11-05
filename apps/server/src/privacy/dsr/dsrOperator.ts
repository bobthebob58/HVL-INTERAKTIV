/**
 * dsrOperator — checks that the person running a data-subject request is an HVL admin with a staff account, and finds
 * that account, which the audit records as the actor.
 *
 * Why: DATA-008 makes the tool admin-only. D-108 has the operator name their own HVL admin account: a Feide ID in
 *      `ADMIN_FEIDE_IDS` that has a staff account, found by keyed hash like a login (D-055), so the audit can name a
 *      `User.id` and nothing else about the operator is stored.
 * Spec: DATA-008, DATA-007
 * Invariants:
 *   - Accepted only when the normalised Feide ID is listed in `ADMIN_FEIDE_IDS` and its Feide identity belongs to a
 *     `staff` account; otherwise refused, before any learner row is read.
 *   - Read only: no identity is created or re-hashed here.
 *   - PRIVACY: the operator's Feide ID is hashed for the lookup and never stored or printed (DATA-002).
 * Collaborators: ./dataSubject.ts (normaliseFeideId), ../../auth/identity/identityLookup.ts,
 *   ../../auth/identity/subjectSources.ts, ../../security/keys/IdentityHasher.ts, ./dataSubjectRequest.ts.
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts
 */
import { findIdentity } from '../../auth/identity/identityLookup.js';
import { identitySource } from '../../auth/identity/subjectSources.js';
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import { normaliseFeideId } from './dataSubject.js';

/** The operator check's outcome: the admin's account, or why the run is refused. */
export type OperatorCheck =
  | { readonly accepted: true; readonly userId: string }
  | { readonly accepted: false; readonly reason: 'not-an-admin' | 'no-staff-account' };

/** What the check reads. */
export interface OperatorCheckDeps {
  readonly db: Database;
  /** `IDENTITY_HASH_KEYS`. */
  readonly hasher: IdentityHasher;
  /** `ADMIN_FEIDE_IDS`, already lower-cased by the configuration. */
  readonly adminFeideIds: readonly string[];
}

/**
 * Checks the operator and finds their staff account.
 * @param deps - Database, identity hasher and the admin list.
 * @param operatorFeideId - The Feide ID the operator gave for themselves.
 * @returns The admin's `User.id`, or the reason for a refusal.
 * @spec DATA-008
 */
export async function checkOperator(
  deps: OperatorCheckDeps,
  operatorFeideId: string,
): Promise<OperatorCheck> {
  const feideId = normaliseFeideId(operatorFeideId);
  // SECURITY: only an HVL admin may run a request (DATA-008); the list is the server's own (D-059).
  if (feideId === undefined || !deps.adminFeideIds.includes(feideId)) {
    return { accepted: false, reason: 'not-an-admin' };
  }
  const { identity } = await findIdentity(
    deps.db,
    deps.hasher,
    'feide',
    identitySource({ kind: 'feide', feideId }),
  );
  if (identity?.user.kind !== 'staff') return { accepted: false, reason: 'no-staff-account' };
  return { accepted: true, userId: identity.userId };
}
