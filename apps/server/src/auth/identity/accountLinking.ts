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
 *     used to look up an existing Feide identity by keyed hash.
 *   - A Feide identity is never created or claimed here: only an account that a Feide login made (and that is not a
 *     learner's) is joined, so nobody can pre-claim someone else's Feide ID and learner identities are never linked.
 *   - No content ever changes owner: an LTI identity moves only when its account owns and co-authors nothing.
 *   - Refused and audited as `link.conflict`: an account that owns content, a learner's Feide account, and a Feide
 *     account that already holds another identity from the same platform.
 *   - Runs before the launch resolves its account, so a new LTI identity joins the Feide account directly.
 * Collaborators: ./linkDecision.ts, ./subjectSources.ts, ../../security/keys/IdentityHasher.ts,
 *   ../audit/AuthAuditRecorder.ts, ../../lti/launch/onDeepLinking.ts, ../../lti/ltiRoutes.ts.
 * Tests: apps/server/test/auth/identity/accountLinking.int.test.ts,
 *   apps/server/test/auth/identity/accountLinkingGuards.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import type { AuthAuditReason, AuthAuditRecorder } from '../audit/AuthAuditRecorder.js';
import type { Role } from '../Principal.js';
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

/** What linking needs. */
export interface AccountLinkerDeps {
  readonly db: Database;
  readonly hasher: IdentityHasher;
  readonly audit: Pick<AuthAuditRecorder, 'record'>;
  /** True for a platform whose `feide_login` was confirmed to be the Feide ID (`feideLinking` in `LTI_PLATFORMS`). */
  readonly linksFeide: (issuer: string, clientId: string) => boolean;
  /** `ALLOWED_FEIDE_ORGS`. */
  readonly allowedOrgs: readonly string[];
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/**
 * Builds the linking step of the Deep Linking launch.
 * @param deps - Database, identity hasher, audit, the platforms that may link, and the allowed Feide realms.
 * @returns A function that links, refuses or does nothing; it never throws for a refusal.
 */
export function accountLinker(deps: AccountLinkerDeps): (request: LinkRequest) => Promise<void> {
  const { db, hasher } = deps;
  const find = (provider: 'feide' | 'lti', source: string) =>
    db.identity.findFirst({
      where: {
        provider,
        subjectHash: { in: hasher.candidates('identity-subject', source).map((c) => c.hash) },
      },
      include: { user: { select: { kind: true } } },
    });
  const audit = (event: 'link.feide-lti' | 'link.conflict', reason: AuthAuditReason, actorUserId?: string) =>
    deps.audit.record({ event, reason, ...(actorUserId ? { actorUserId } : {}) });

  return async (request) => {
    // SECURITY: the value is whatever the platform says; only platforms confirmed to send the Feide ID count (Q4).
    if (!deps.linksFeide(request.issuer, request.clientId)) return;
    const feideId = feideLoginFromLaunch(request.claims, request.roles);
    if (!feideId || !deps.allowedOrgs.includes(feideId.slice(feideId.lastIndexOf('@') + 1))) return;
    const ltiSource = identitySource({ kind: 'lti', issuer: request.issuer, subject: request.subject });
    const [lti, feide] = await Promise.all([
      find('lti', ltiSource),
      find('feide', identitySource({ kind: 'feide', feideId })),
    ]);
    if (!feide) return;
    // PRIVACY: a learner's Feide account is never joined to a Canvas identity (D-063, DATA-002).
    if (feide.user.kind === 'learner') return audit('link.conflict', 'learner-account', lti?.userId);
    // SECURITY: two Canvas users of one platform naming the same Feide ID means one of them is not that person.
    const rival = await db.identity.count({
      where: {
        userId: feide.userId,
        provider: 'lti',
        platformId: request.platformId,
        ...(lti ? { NOT: { id: lti.id } } : {}),
      },
    });
    if (rival > 0) return audit('link.conflict', 'platform-identity-exists', lti?.userId ?? feide.userId);
    const ownsAnything = lti
      ? (await db.h5PContent.count({ where: { ownerUserId: lti.userId } })) +
          (await db.contentCollaborator.count({ where: { userId: lti.userId } })) >
        0
      : false;
    const decision = decideLink({
      lti: lti ? { accountId: lti.userId, ownsAnything } : undefined,
      feide: { accountId: feide.userId },
    });
    try {
      switch (decision.kind) {
        case 'link-new': {
          const { hash, keyId } = hasher.hash('identity-subject', ltiSource);
          await db.identity.create({
            data: {
              provider: 'lti',
              subjectHash: hash,
              subjectKeyId: keyId,
              platformId: request.platformId,
              userId: decision.feideAccountId,
            },
          });
          return audit('link.feide-lti', 'link-joined', decision.feideAccountId);
        }
        case 'move-lti-to-feide': {
          // WHY: the "owns nothing" condition is part of the update, so content created a moment ago stays put.
          const moved = await db.identity.updateMany({
            where: {
              id: lti?.id ?? '',
              userId: decision.fromAccountId,
              user: { ownedContent: { none: {} }, collaborations: { none: {} } },
            },
            data: { userId: decision.toAccountId },
          });
          if (moved.count === 0)
            return audit('link.conflict', 'lti-account-owns-content', decision.fromAccountId);
          return audit('link.feide-lti', 'link-moved', decision.toAccountId);
        }
        case 'conflict':
          return audit('link.conflict', 'lti-account-owns-content', decision.ltiAccountId);
        case 'already-linked':
        case 'no-feide-account':
          return;
      }
    } catch (error) {
      // WHY: a concurrent launch linked the same identities a moment ago; its result stands.
      if (!isUniqueViolation(error)) throw error;
    }
  };
}
