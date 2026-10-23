/**
 * accountLinking — links a teacher's Canvas identity to their Feide identity at a Deep Linking launch (AUTH-005).
 *
 * Why: a teacher should find one personal library whether they arrive from Canvas or the portal. Canvas sends the
 *      teacher's login ID as `custom.feide_login` on the Deep Linking placements only; D-063 says how the two
 *      identities are joined, and when nothing may change.
 * Spec: AUTH-005, DATA-002
 * Invariants:
 *   - Only authors' launches are read (./linkDecision.ts `feideLoginFromLaunch`); the value is never stored, only
 *     its keyed hash as a Feide identity.
 *   - No content ever changes owner: an LTI identity moves only when its account owns and co-authors nothing.
 *   - Refused and audited as `link.conflict`: an account that owns content, a Feide account of a learner (learner
 *     identities are never linked), and an account that already has another Feide identity.
 *   - Runs before the launch resolves its account, so a new LTI identity joins the Feide account directly.
 * Collaborators: ./linkDecision.ts, ./subjectSources.ts, ../../security/keys/IdentityHasher.ts,
 *   ../audit/AuthAuditRecorder.ts, ../../lti/launch/onDeepLinking.ts.
 * Tests: apps/server/test/auth/identity/accountLinking.int.test.ts
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
  readonly subject: string;
  readonly platformId: string;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/**
 * Builds the linking step of the Deep Linking launch.
 * @param deps - Database, identity hasher and audit.
 * @returns A function that links, refuses or does nothing; it never throws for a refusal.
 */
export function accountLinker(deps: {
  db: Database;
  hasher: IdentityHasher;
  audit: Pick<AuthAuditRecorder, 'record'>;
}): (request: LinkRequest) => Promise<void> {
  const { db, hasher } = deps;
  const find = (provider: 'feide' | 'lti', source: string) =>
    db.identity.findFirst({
      where: {
        provider,
        subjectHash: { in: hasher.candidates('identity-subject', source).map((c) => c.hash) },
      },
      include: { user: { select: { kind: true } } },
    });
  const identityData = (provider: 'feide' | 'lti', source: string, platformId?: string) => {
    const { hash, keyId } = hasher.hash('identity-subject', source);
    return { provider, subjectHash: hash, subjectKeyId: keyId, platformId: platformId ?? null };
  };
  const audit = (event: 'link.feide-lti' | 'link.conflict', reason: AuthAuditReason, actorUserId?: string) =>
    deps.audit.record({ event, reason, ...(actorUserId ? { actorUserId } : {}) });

  return async (request) => {
    const feideId = feideLoginFromLaunch(request.claims, request.roles);
    if (!feideId) return;
    const ltiSource = identitySource({ kind: 'lti', issuer: request.issuer, subject: request.subject });
    const feideSource = identitySource({ kind: 'feide', feideId });
    const [lti, feide] = await Promise.all([find('lti', ltiSource), find('feide', feideSource)]);
    // PRIVACY: a learner's Feide account is never joined to a Canvas identity (D-063, DATA-002).
    if (feide && feide.user.kind === 'learner') return audit('link.conflict', 'learner-account', lti?.userId);
    const ownsAnything = lti
      ? (await db.h5PContent.count({ where: { ownerUserId: lti.userId } })) +
          (await db.contentCollaborator.count({ where: { userId: lti.userId } })) >
        0
      : false;
    const decision = decideLink({
      lti: lti ? { accountId: lti.userId, ownsAnything } : undefined,
      feide: feide ? { accountId: feide.userId } : undefined,
    });
    try {
      switch (decision.kind) {
        case 'link-new':
          if (decision.feideAccountId) {
            await db.identity.create({
              data: {
                ...identityData('lti', ltiSource, request.platformId),
                userId: decision.feideAccountId,
              },
            });
            return audit('link.feide-lti', 'link-joined', decision.feideAccountId);
          }
          {
            const user = await db.user.create({
              data: {
                kind: 'staff',
                identities: {
                  create: [
                    identityData('lti', ltiSource, request.platformId),
                    identityData('feide', feideSource),
                  ],
                },
              },
            });
            return audit('link.feide-lti', 'link-created', user.id);
          }
        case 'attach-lti-to-feide': {
          // SECURITY: one account never holds two Feide IDs; a second one could reach someone else's portal library.
          if ((await db.identity.count({ where: { userId: decision.accountId, provider: 'feide' } })) > 0) {
            return audit('link.conflict', 'feide-identity-exists', decision.accountId);
          }
          await db.identity.create({
            data: { ...identityData('feide', feideSource), userId: decision.accountId },
          });
          return audit('link.feide-lti', 'link-joined', decision.accountId);
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
          return;
      }
    } catch (error) {
      // WHY: a concurrent launch linked the same identities a moment ago; its result stands.
      if (!isUniqueViolation(error)) throw error;
    }
  };
}
