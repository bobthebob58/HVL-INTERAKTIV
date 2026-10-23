/**
 * completeFeideLogin — everything between Feide's callback and a new portal session: token checks, Feide ID,
 * groups, roles, account, pseudonym.
 *
 * Why: AUTH-001 to AUTH-004 meet here. The ID token is validated (state, nonce, PKCE, issuer, audience, expiry,
 *      signature); the Feide ID is the subject (D-054); roles come from the Groups API (AUTH-002) and are fixed for
 *      the session (D-057); only staff keep a name and e-mail (AUTH-004); learners are pseudonyms (DATA-002).
 * Spec: AUTH-001, AUTH-002, AUTH-003, AUTH-004, DATA-002
 * Invariants:
 *   - A login without a Feide ID is refused (403 page, D-054); a Groups API failure fails closed (503).
 *   - Neither the Feide ID, the `sub`, the access token nor any national ID number is stored in plaintext; the ID
 *     token (which may hold them) is handed to the session store, which keeps it only encrypted until logout or
 *     expiry (D-021, D-056).
 *   - Every outcome is audited with a fixed code (D-064).
 * Collaborators: ./FeideClient.ts, ./feideGroups.ts, ./FeideRoleMapper.ts, ./feideClaims.ts,
 *   ../identity/AccountResolver.ts, ../identity/subjectSources.ts, ../audit/AuthAuditRecorder.ts,
 *   ./feideLoginRoutes.ts.
 * Tests: apps/server/test/auth/feide/feideLogin.int.test.ts
 */
import type { HttpError } from '../../http/HttpError.js';
import { authError, isAuthError } from '../../http/authErrors.js';
import { deriveLearnerKey } from '../../privacy/deriveLearnerKey.js';
import type { PseudonymSecrets } from '../../privacy/pseudonymSecrets.js';
import type { AuthAuditRecorder } from '../audit/AuthAuditRecorder.js';
import type { AccountResolver } from '../identity/AccountResolver.js';
import { identitySource, learnerSourceOf } from '../identity/subjectSources.js';
import type { NewPortalSession } from '../session/portalSessionRecord.js';
import { authorProfile, readFeideIdentity } from './feideClaims.js';
import type { FeideClient, LoginChecks } from './FeideClient.js';
import { fetchFeideGroups } from './feideGroups.js';
import { mapFeideRoles, type FeideRolePolicy } from './FeideRoleMapper.js';

/** What completing a login needs. */
export interface FeideLoginDeps {
  readonly feide: Pick<FeideClient, 'completeLogin'>;
  readonly groupsApiUrl: string;
  readonly policy: FeideRolePolicy;
  readonly accounts: AccountResolver;
  readonly secrets: PseudonymSecrets;
  readonly audit: Pick<AuthAuditRecorder, 'record'>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Validates the callback and computes the new session.
 * @param deps - Feide client, Groups API URL, role policy, accounts, pseudonym secrets, audit.
 * @param callbackUrl - The full callback URL (on `PUBLIC_BASE_URL`).
 * @param checks - The state, nonce and PKCE verifier of this browser's login transaction.
 * @param ip - The client address, for the audit hash.
 * @returns The session to start (ID token included, in memory only).
 * @throws HttpError: 400 `hvl:login-failed` for a refused callback, 403 `hvl:no-feide-id`, 503
 *   `hvl:feide-groups-unavailable`.
 */
export async function completeFeideLogin(
  deps: FeideLoginDeps,
  callbackUrl: URL,
  checks: LoginChecks,
  ip?: string,
): Promise<NewPortalSession> {
  const now = (deps.now ?? (() => new Date()))();
  const fail = async (reason: 'token-invalid' | 'no-feide-id' | 'groups-unavailable', error: HttpError) => {
    await deps.audit.record({ event: 'login.feide.failed', reason, ip });
    return error;
  };
  let tokens;
  try {
    tokens = await deps.feide.completeLogin(callbackUrl, checks);
  } catch {
    // SECURITY: a wrong state, issuer, audience, nonce, expiry or signature ends here (AUTH-001).
    throw await fail('token-invalid', authError('hvl:login-failed'));
  }
  const identity = readFeideIdentity(tokens.claims);
  if (!identity) throw await fail('no-feide-id', authError('hvl:no-feide-id'));
  let groups: unknown[];
  try {
    groups = await fetchFeideGroups(deps.groupsApiUrl, tokens.accessToken, deps.fetchImpl);
  } catch (error) {
    if (!isAuthError(error, 'hvl:feide-groups-unavailable')) throw error;
    throw await fail('groups-unavailable', error as HttpError);
  }
  const roles = mapFeideRoles({ feideId: identity.feideId, groups }, deps.policy, now);
  const subject = { kind: 'feide', feideId: identity.feideId } as const;
  const staff = roles.roles.some((role) => role !== 'learner');
  const account = await deps.accounts.resolve({
    provider: 'feide',
    source: identitySource(subject),
    kind: staff ? 'staff' : 'learner',
    // PRIVACY: authorProfile returns nothing for learners (AUTH-004, DATA-002).
    profile: authorProfile(tokens.claims, roles.roles),
  });
  await deps.audit.record({ event: 'login.feide', actorUserId: account.userId, ip });
  return {
    userId: account.userId,
    roles: roles.roles,
    hvlMember: roles.hvlMember,
    studentAuthor: roles.studentAuthor,
    // WHY: Feide sends no UI language; Nynorsk is the default until the portal lets people choose (PROD-012).
    locale: 'nn',
    learnerKey: deriveLearnerKey(learnerSourceOf(subject), deps.secrets, now),
    idToken: tokens.idToken,
  };
}
