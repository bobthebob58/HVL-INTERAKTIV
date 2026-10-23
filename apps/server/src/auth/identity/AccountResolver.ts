/**
 * AccountResolver — finds or creates the account behind a login (Feide) or a launch (LTI), by keyed hash only.
 *
 * Why: the same person must reach the same account at every login without the server storing their Feide ID or
 *      LTI `sub` (DATA-002). `Identity.subjectHash` is an HMAC under the identity key ring; after a key rotation a
 *      lookup must still find rows made with an older key and re-hash them with the current one (D-055).
 * Spec: DATA-002, AUTH-001, AUTH-004, LTI-001
 * Invariants:
 *   - Only the hash and its key ID are stored, never the source text.
 *   - Learner rows never get a name or e-mail (the database refuses it, DATA-002); a profile is stored only for
 *     staff (AUTH-004) and refreshed at each staff login.
 *   - A learner account becomes staff when the person now authors; a staff account is never downgraded, because it
 *     may own content that co-authors know by name.
 *   - Two first logins at the same moment create one account: the loser of the unique-key race re-reads it.
 * Collaborators: ./subjectSources.ts, ../../security/keys/IdentityHasher.ts, ../feide/completeFeideLogin.ts,
 *   ../../lti/launch/ltiAccount.ts.
 * Tests: apps/server/test/auth/identity/AccountResolver.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';

/** Who is logging in, as the resolver needs it. */
export interface AccountRequest {
  /** Feide login or LTI launch. */
  readonly provider: 'feide' | 'lti';
  /** The identity source text (`feide|<id>` or `lti|<iss>|<sub>`); hashed, never stored. */
  readonly source: string;
  /** For LTI identities, the `LtiPlatform.id`. */
  readonly platformId?: string;
  /** `staff` when the person authors or administers now; `learner` otherwise. */
  readonly kind: 'staff' | 'learner';
  /** Name and e-mail for staff (AUTH-004); ignored for learners. */
  readonly profile?: { readonly displayName?: string; readonly email?: string };
}

/** The account found or created. */
export interface ResolvedAccount {
  /** `User.id`. */
  readonly userId: string;
  /** The account's kind after this login. */
  readonly kind: 'staff' | 'learner';
  /** True when this login created the account. */
  readonly created: boolean;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/** Finds or creates accounts by identity hash. */
export class AccountResolver {
  /**
   * @param deps - The database and the identity hasher.
   */
  constructor(private readonly deps: { db: Database; hasher: IdentityHasher }) {}

  /**
   * Finds the account for a login, re-hashing its identity with the current key, or creates it.
   * @param request - Provider, source, platform, kind and staff profile.
   * @returns The account.
   */
  async resolve(request: AccountRequest): Promise<ResolvedAccount> {
    const found = await this.find(request);
    if (found) return found;
    try {
      return await this.create(request);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // WHY: another request created this identity a moment ago; use its account.
      const raced = await this.find(request);
      if (!raced) throw error;
      return raced;
    }
  }

  private async find(request: AccountRequest): Promise<ResolvedAccount | undefined> {
    const { db, hasher } = this.deps;
    const candidates = hasher.candidates('identity-subject', request.source);
    const identity = await db.identity.findFirst({
      where: { provider: request.provider, subjectHash: { in: candidates.map((c) => c.hash) } },
      include: { user: true },
    });
    if (!identity) return undefined;
    const [current] = candidates;
    if (current && identity.subjectKeyId !== current.keyId) {
      // SECURITY: rotation (D-055): from now on the row is found under the current key only.
      await db.identity.update({
        where: { id: identity.id },
        data: { subjectHash: current.hash, subjectKeyId: current.keyId },
      });
    }
    const kind = identity.user.kind === 'staff' || request.kind === 'staff' ? 'staff' : 'learner';
    if (kind === 'staff') {
      await db.user.update({ where: { id: identity.userId }, data: { kind, ...this.profileOf(request) } });
    }
    return { userId: identity.userId, kind, created: false };
  }

  private async create(request: AccountRequest): Promise<ResolvedAccount> {
    const current = this.deps.hasher.hash('identity-subject', request.source);
    const user = await this.deps.db.user.create({
      data: {
        kind: request.kind,
        ...(request.kind === 'staff' ? this.profileOf(request) : {}),
        identities: {
          create: {
            provider: request.provider,
            subjectHash: current.hash,
            subjectKeyId: current.keyId,
            platformId: request.platformId ?? null,
          },
        },
      },
    });
    return { userId: user.id, kind: request.kind, created: true };
  }

  private profileOf(request: AccountRequest): { displayName?: string; email?: string } {
    // PRIVACY: only staff profiles are stored, and only what Feide released for co-author search (AUTH-004).
    const profile = request.kind === 'staff' ? (request.profile ?? {}) : {};
    return {
      ...(profile.displayName !== undefined ? { displayName: profile.displayName } : {}),
      ...(profile.email !== undefined ? { email: profile.email } : {}),
    };
  }
}
