/**
 * AccountResolver — finds or creates the account behind a login (Feide) or a launch (LTI), by keyed hash only.
 *
 * Why: the same person must reach the same account at every login without the server storing their Feide ID or
 *      LTI `sub` (DATA-002). `Identity.subjectHash` is an HMAC under the identity key ring; after a key rotation a
 *      lookup must still find rows made with an older key and re-hash them with the current one (D-055).
 * Spec: DATA-002, AUTH-001, AUTH-004, LTI-001
 * Invariants:
 *   - Only the hash and its key ID are stored, never the source text.
 *   - Learner rows never get a name or e-mail (the database refuses it, DATA-002); a profile (the display name) is
 *     stored only for staff (AUTH-004) and refreshed at each staff login, which also clears `email` (D-090
 *     amendment 2026-10-29: no e-mail is kept).
 *   - A learner account becomes staff when the person now authors; a staff account is never downgraded, because it
 *     may own content that co-authors know by name.
 *   - PRIVACY: `User.coAuthorSearchableAt` is written only for a Feide login that states it (D-090): set when the
 *     login makes the person findable as a co-author, cleared when it does not. An LTI launch never changes it.
 *   - Two first logins at the same moment create one account: the loser of the unique-key race re-reads it.
 *   - When one person has rows under several keys (mixed key rings during a rotation), the row under the current
 *     key wins, else the oldest; a re-hash that collides keeps the login working instead of failing it.
 * Collaborators: ./subjectSources.ts, ./identityLookup.ts (which row wins), ../../security/keys/IdentityHasher.ts, ../feide/completeFeideLogin.ts,
 *   ../../lti/launch/ltiAccount.ts.
 * Tests: apps/server/test/auth/identity/AccountResolver.int.test.ts,
 *   apps/server/test/auth/identity/AccountResolver.test.ts, apps/server/test/auth/feide/coAuthorSearchable.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import { findIdentity } from './identityLookup.js';

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
  /** The display name for staff (AUTH-004); ignored for learners. */
  readonly profile?: { readonly displayName?: string };
  /**
   * Feide logins only (D-090): the login time when this login makes the person findable as a co-author, or null
   * to clear an earlier one (../../learningDesign/collaboration/staffEligibility.ts). Ignored for LTI launches.
   */
  readonly coAuthorSearchableAt?: Date | null;
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

  /**
   * Finds an existing account without changing anything (for requests that resume a launch or a session).
   * @param provider - Feide or LTI.
   * @param source - The identity source text.
   * @returns The `User.id`, or undefined when no account has this identity.
   */
  async lookup(provider: AccountRequest['provider'], source: string): Promise<string | undefined> {
    return (await findIdentity(this.deps.db, this.deps.hasher, provider, source)).identity?.userId;
  }

  private async find(request: AccountRequest): Promise<ResolvedAccount | undefined> {
    const { db, hasher } = this.deps;
    const { identity, current } = await findIdentity(db, hasher, request.provider, request.source);
    if (!identity) return undefined;
    if (current && identity.subjectKeyId !== current.keyId) {
      try {
        // SECURITY: rotation (D-055): from now on the row is found under the current key only.
        await db.identity.update({
          where: { id: identity.id },
          data: { subjectHash: current.hash, subjectKeyId: current.keyId },
        });
      } catch (error) {
        // WHY: a row under the current key appeared meanwhile; the login still uses the row found.
        if (!isUniqueViolation(error)) throw error;
      }
    }
    const kind = identity.user.kind === 'staff' || request.kind === 'staff' ? 'staff' : 'learner';
    if (kind === 'staff') {
      await db.user.update({
        where: { id: identity.userId },
        data: { kind, ...this.profileOf(request), ...this.searchableOf(request) },
      });
    }
    return { userId: identity.userId, kind, created: false };
  }

  private async create(request: AccountRequest): Promise<ResolvedAccount> {
    const current = this.deps.hasher.hash('identity-subject', request.source);
    const user = await this.deps.db.user.create({
      data: {
        kind: request.kind,
        ...(request.kind === 'staff' ? { ...this.profileOf(request), ...this.searchableOf(request) } : {}),
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

  private searchableOf(request: AccountRequest): { coAuthorSearchableAt?: Date | null } {
    // SECURITY: only the Feide login decides who colleagues can find; a Canvas launch can never make anyone findable.
    const { provider, coAuthorSearchableAt } = request;
    return provider === 'feide' && coAuthorSearchableAt !== undefined ? { coAuthorSearchableAt } : {};
  }

  private profileOf(request: AccountRequest): { displayName?: string; email?: null } {
    // PRIVACY: only staff profiles are stored, and only the name co-author search shows (AUTH-004).
    if (request.kind !== 'staff') return {};
    const { displayName } = request.profile ?? {};
    // SPEC-DEVIATION: D-090 amendment 2026-10-29: AUTH-004 kept staff e-mail, which nothing uses, so every staff
    // write clears one stored before.
    return { ...(displayName !== undefined ? { displayName } : {}), email: null };
  }
}
