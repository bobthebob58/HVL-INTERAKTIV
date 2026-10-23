/**
 * accountLinking — links a teacher's Canvas identity to their Feide identity at a Deep Linking launch (AUTH-005).
 *
 * Why: a teacher should find one personal library whether they arrive from Canvas or the portal. Canvas sends the
 *      teacher's login ID as `custom.feide_login` on the Deep Linking placements only; D-063 says how the two
 *      identities are joined, and when nothing may change. The value comes from the platform alone, so it is
 *      trusted only from platforms where it has been confirmed to be the Feide ID (AUTH-005 *(verify)*, Q4).
 * Spec: AUTH-005, DATA-002
 * Invariants:
 *   - Nothing happens unless the launch's platform has `feideLinking: true` in `LTI_PLATFORMS` and the Feide ID's
 *     realm is in `ALLOWED_FEIDE_ORGS`.
 *   - Only authors' launches are read (./linkDecision.ts `feideLoginFromLaunch`); the value is never stored, only
 *     used to look up an existing Feide identity by keyed hash (./identityLookup.ts, the row login also uses).
 *   - A Feide identity is never created or claimed here: only an account that a Feide login made (and that is not a
 *     learner's) is joined, so nobody can pre-claim someone else's Feide ID and learner identities are never linked.
 *   - No content ever changes owner: an LTI identity moves only when its account owns and co-authors nothing.
 *   - Refusals (`link.conflict`): an account that owns content, a learner's Feide account, and a Feide account that
 *     already holds another identity from the same platform. The rival check and the write run in one transaction
 *     with the Feide account's row locked, so two simultaneous claims cannot both succeed.
 *   - The outcome is returned, not recorded: the caller audits it as an action of the claimant's account.
 *   - Runs before the launch resolves its account, so a new LTI identity joins the Feide account directly.
 * Collaborators: ./linkDecision.ts, ./identityLookup.ts, ./subjectSources.ts, ../../security/keys/IdentityHasher.ts,
 *   ../../lti/launch/onDeepLinking.ts (audits the outcome), ../../lti/linkingPlatforms.ts, ../../lti/ltiRoutes.ts.
 * Tests: apps/server/test/auth/identity/accountLinking.int.test.ts,
 *   apps/server/test/auth/identity/accountLinkingGuards.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import type { AuthAuditReason } from '../audit/AuthAuditRecorder.js';
import type { Role } from '../Principal.js';
import { findIdentity } from './identityLookup.js';
import { decideLink, feideLoginFromLaunch } from './linkDecision.js';
import { identitySource } from './subjectSources.js';

/** The launch facts linking needs (all in memory; nothing here is stored as given). */
export interface LinkRequest {
  readonly claims: Readonly<Record<string, unknown>>;
  readonly roles: readonly Role[];
  readonly issuer: string;
  /** The platform's client ID for this tool (with `issuer`, it names the `LTI_PLATFORMS` entry). */
  readonly clientId: string;
  readonly subject: string;
  readonly platformId: string;
}

/** What linking did, for the audit (D-064). */
export interface LinkOutcome {
  readonly event: 'link.feide-lti' | 'link.conflict';
  readonly reason: AuthAuditReason;
}

/** What linking needs. */
export interface AccountLinkerDeps {
  readonly db: Database;
  readonly hasher: IdentityHasher;
  /** True for a platform whose `feide_login` was confirmed to be the Feide ID (`feideLinking` in `LTI_PLATFORMS`). */
  readonly linksFeide: (issuer: string, clientId: string) => boolean;
  /** `ALLOWED_FEIDE_ORGS`. */
  readonly allowedOrgs: readonly string[];
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

const outcome = (event: LinkOutcome['event'], reason: AuthAuditReason): LinkOutcome => ({ event, reason });

/**
 * Builds the linking step of the Deep Linking launch.
 * @param deps - Database, identity hasher, the platforms that may link, and the allowed Feide realms.
 * @returns A function that links, refuses or does nothing, and says which; it never throws for a refusal.
 */
export function accountLinker(
  deps: AccountLinkerDeps,
): (request: LinkRequest) => Promise<LinkOutcome | undefined> {
  const { db, hasher } = deps;
  return async (request) => {
    // SECURITY: the value is whatever the platform says; only platforms confirmed to send the Feide ID count (Q4).
    if (!deps.linksFeide(request.issuer, request.clientId)) return undefined;
    const feideId = feideLoginFromLaunch(request.claims, request.roles);
    if (!feideId || !deps.allowedOrgs.includes(feideId.slice(feideId.lastIndexOf('@') + 1))) return undefined;
    const ltiSource = identitySource({ kind: 'lti', issuer: request.issuer, subject: request.subject });
    const [{ identity: lti }, { identity: feide }] = await Promise.all([
      findIdentity(db, hasher, 'lti', ltiSource),
      findIdentity(db, hasher, 'feide', identitySource({ kind: 'feide', feideId })),
    ]);
    if (!feide) return undefined;
    // PRIVACY: a learner's Feide account is never joined to a Canvas identity (D-063, DATA-002).
    if (feide.user.kind === 'learner') return outcome('link.conflict', 'learner-account');
    const ownsAnything = lti
      ? (await db.h5PContent.count({ where: { ownerUserId: lti.userId } })) +
          (await db.contentCollaborator.count({ where: { userId: lti.userId } })) >
        0
      : false;
    const decision = decideLink({
      lti: lti ? { accountId: lti.userId, ownsAnything } : undefined,
      feide: { accountId: feide.userId },
    });
    if (decision.kind === 'already-linked' || decision.kind === 'no-feide-account') return undefined;
    if (decision.kind === 'conflict') return outcome('link.conflict', 'lti-account-owns-content');
    try {
      return await db.$transaction(async (tx) => {
        // WHY: two Canvas users claiming this account at the same moment must not both pass the rival check.
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${feide.userId}::uuid FOR UPDATE`;
        // SECURITY: two Canvas users of one platform naming the same Feide ID means one of them is not that person.
        const rival = await tx.identity.count({
          where: {
            userId: feide.userId,
            provider: 'lti',
            platformId: request.platformId,
            ...(lti ? { NOT: { id: lti.id } } : {}),
          },
        });
        if (rival > 0) return outcome('link.conflict', 'platform-identity-exists');
        if (decision.kind === 'link-new') {
          const { hash, keyId } = hasher.hash('identity-subject', ltiSource);
          await tx.identity.create({
            data: {
              provider: 'lti',
              subjectHash: hash,
              subjectKeyId: keyId,
              platformId: request.platformId,
              userId: decision.feideAccountId,
            },
          });
          return outcome('link.feide-lti', 'link-joined');
        }
        // WHY: the "owns nothing" condition is part of the update, so content created a moment ago stays put.
        const moved = await tx.identity.updateMany({
          where: {
            id: lti?.id ?? '',
            userId: decision.fromAccountId,
            user: { ownedContent: { none: {} }, collaborations: { none: {} } },
          },
          data: { userId: decision.toAccountId },
        });
        if (moved.count === 1) return outcome('link.feide-lti', 'link-moved');
        const now = await tx.identity.findUnique({ where: { id: lti?.id ?? '' }, select: { userId: true } });
        // WHY: a second launch at the same moment (a double click) already moved it; that is no conflict.
        if (now?.userId === decision.toAccountId) return undefined;
        return outcome('link.conflict', 'lti-account-owns-content');
      });
    } catch (error) {
      // WHY: a concurrent launch linked the same identities a moment ago; its result stands.
      if (!isUniqueViolation(error)) throw error;
      return undefined;
    }
  };
}
