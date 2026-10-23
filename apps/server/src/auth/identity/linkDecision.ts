/**
 * linkDecision — decides how an author's Canvas identity and their Feide identity end up in one account, and reads
 * the `feide_login` value that names the Feide ID.
 *
 * Why: AUTH-005 wants one personal library whether a teacher arrives through Canvas or the portal. D-063 fixes the
 *      cases: the LTI identity joins the teacher's existing Feide account when that loses nothing, and when both
 *      identities already have different accounts it moves only if its account owns nothing, so content never
 *      changes owner through linking. Keeping the decision pure makes every case testable without a database.
 * Spec: AUTH-005
 * Invariants:
 *   - `feide_login` is read only when the LTI roles give `author`; a value starting with `$` (an unexpanded Canvas
 *     variable) or not a valid Feide ID is ignored; the value is normalised and never stored (D-063).
 *   - Learner identities are never linked: a learner launch yields no Feide ID, so no decision is made.
 *   - Only an existing Feide account is ever joined; without one the decision is `no-feide-account` (D-063).
 *   - `conflict` changes nothing; `move-lti-to-feide` happens only when the LTI account owns nothing.
 * Collaborators: ./accountLinking.ts (applies the decision), ../../lti/launch/onDeepLinking.ts (audits it),
 *   ./AccountResolver.ts,
 *   ../../lti/LtiRoleMapper.ts, ../audit/AuthAuditRecorder.ts (`link.*` events), ../Principal.ts.
 * Tests: apps/server/test/auth/identity/linkDecision.test.ts
 */
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import { canAuthor, type Role } from '../Principal.js';

/** The LTI custom-parameter claim. */
const LTI_CUSTOM_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/custom';

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** An existing account that holds an identity. */
export interface LinkedAccount {
  /** `User.id`. */
  readonly accountId: string;
}

/** The account of the launching author's LTI identity. */
export interface LtiLinkedAccount extends LinkedAccount {
  /** The account owns an activity or is a co-author of one. */
  readonly ownsAnything: boolean;
}

/** What exists for the two identities of one author. */
export interface LinkSituation {
  /** The account of the LTI identity (`lti|<iss>|<sub>`), or undefined when that identity does not exist yet. */
  readonly lti: LtiLinkedAccount | undefined;
  /** The account of the Feide identity for the `feide_login` Feide ID, or undefined when there is none. */
  readonly feide: LinkedAccount | undefined;
}

/** What to do (D-063). */
export type LinkDecision =
  /** No Feide account for this Feide ID: nothing is linked. A Feide identity is never created or claimed from the
   *  Canvas side, so nobody can pre-claim someone else's Feide ID and no learner's Feide ID is linked. */
  | { readonly kind: 'no-feide-account' }
  /** No LTI identity yet: create it on the Feide account. */
  | { readonly kind: 'link-new'; readonly feideAccountId: string }
  /** Both identities are already in the same account: nothing to do. */
  | { readonly kind: 'already-linked'; readonly accountId: string }
  /** Different accounts and the LTI account owns nothing: move the LTI identity to the Feide account. */
  | { readonly kind: 'move-lti-to-feide'; readonly fromAccountId: string; readonly toAccountId: string }
  /** Different accounts and the LTI account owns content: change nothing, audit `link.conflict`. */
  | { readonly kind: 'conflict'; readonly ltiAccountId: string; readonly feideAccountId: string };

/**
 * Decides how to link an author's LTI and Feide identities (D-063).
 * @param situation - Which of the two identities exist, in which accounts, and whether the LTI account owns anything.
 * @returns The decision; the caller applies it and audits it.
 * @spec AUTH-005
 */
export function decideLink(situation: LinkSituation): LinkDecision {
  const { lti, feide } = situation;
  // SECURITY: only a Feide login creates a Feide identity; a Canvas claim alone never does (D-063).
  if (feide === undefined) return { kind: 'no-feide-account' };
  if (lti === undefined) return { kind: 'link-new', feideAccountId: feide.accountId };
  if (lti.accountId === feide.accountId) return { kind: 'already-linked', accountId: lti.accountId };
  // WHY: moving an identity whose account owns content would split that content from its owner (D-063).
  if (lti.ownsAnything) {
    return { kind: 'conflict', ltiAccountId: lti.accountId, feideAccountId: feide.accountId };
  }
  return { kind: 'move-lti-to-feide', fromAccountId: lti.accountId, toAccountId: feide.accountId };
}

/**
 * The Feide ID a Deep Linking launch names in `custom.feide_login` (AUTH-005, D-063).
 * @param claims - The launch's full ID-token claims (the stored allowlist drops `feide_login`, D-052).
 * @param roles - The roles from `mapLtiRoles`.
 * @returns The normalised Feide ID, or undefined for a learner, an unexpanded `$…` value or a malformed ID.
 * @spec AUTH-005
 */
export function feideLoginFromLaunch(
  claims: Readonly<Record<string, unknown>>,
  roles: readonly Role[],
): string | undefined {
  // PRIVACY: a learner's login ID is never read, so learner identities are never linked across modes (DATA-002).
  if (!canAuthor({ roles })) return undefined;
  const custom = claims[LTI_CUSTOM_CLAIM];
  const raw = isObject(custom) ? custom.feide_login : undefined;
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  // WHY: Canvas sends the variable name itself (`$Canvas.user.loginId`) when it cannot expand it; that is no ID.
  if (value.startsWith('$')) return undefined;
  const feideId = value.toLowerCase();
  return FEIDE_ID_PATTERN.test(feideId) ? feideId : undefined;
}
