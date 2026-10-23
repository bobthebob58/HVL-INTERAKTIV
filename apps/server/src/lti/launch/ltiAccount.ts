/**
 * ltiAccount — the account and the learner pseudonym behind an LTI launch, and behind every later request that
 * resumes it with its ltik.
 *
 * Why: a Canvas user is known by the platform's issuer and `sub`. Learners get pseudonymous User rows (D-034) found
 *      by identity hash (D-055), and their H5P state is keyed by the yearly learnerKey (DATA-002). The launch may
 *      create the account; a resumed request only looks it up, so it writes nothing.
 * Spec: LTI-001, DATA-002, LTI-004
 * Invariants:
 *   - The `sub` is used in memory only: hashed for the identity, HMAC'd for the learnerKey, never stored.
 *   - LTI accounts carry no profile: Canvas names and e-mail are never stored (AUTH-004, privacy_level anonymous).
 *   - An author launch makes the account `staff`; it is never made admin here (LTI-004).
 * Collaborators: ../../auth/identity/AccountResolver.ts, ../../privacy/deriveLearnerKey.ts, ./onResourceLink.ts,
 *   ../ltikPrincipal.ts.
 * Tests: apps/server/test/lti/launch/ltiAccount.int.test.ts
 */
import type { AccountResolver } from '../../auth/identity/AccountResolver.js';
import type { Role } from '../../auth/Principal.js';
import { deriveLearnerKey, pseudonymSource } from '../../privacy/deriveLearnerKey.js';
import type { PseudonymSecrets } from '../../privacy/pseudonymSecrets.js';

/** Who launched, as the launch's claims say. */
export interface LtiIdentity {
  /** The platform's `iss`. */
  readonly issuer: string;
  /** The user's `sub` on that platform (in memory only). */
  readonly subject: string;
  /** `LtiPlatform.id`. */
  readonly platformId: string;
  /** Roles from the LTI role mapping. */
  readonly roles: readonly Role[];
}

/** The account behind a launch. */
export interface LtiAccount {
  /** `User.id`. */
  readonly userId: string;
  /** The learner pseudonym for this academic year. */
  readonly learnerKey: string;
}

/** Resolves LTI accounts. */
export class LtiAccounts {
  /**
   * @param deps - The account resolver, the pseudonym secrets and a clock.
   */
  constructor(
    private readonly deps: { accounts: AccountResolver; secrets: PseudonymSecrets; now?: () => Date },
  ) {}

  private learnerKeyOf(identity: LtiIdentity): string {
    const source = { kind: 'lti', issuer: identity.issuer, subject: identity.subject } as const;
    return deriveLearnerKey(source, this.deps.secrets, (this.deps.now ?? (() => new Date()))());
  }

  /**
   * At a launch: finds or creates the account.
   * @param identity - The launch's issuer, sub, platform and roles.
   * @returns The account and the learnerKey.
   */
  async atLaunch(identity: LtiIdentity): Promise<LtiAccount> {
    const { userId } = await this.deps.accounts.resolve({
      provider: 'lti',
      source: pseudonymSource({ kind: 'lti', issuer: identity.issuer, subject: identity.subject }),
      platformId: identity.platformId,
      kind: identity.roles.includes('author') ? 'staff' : 'learner',
    });
    return { userId, learnerKey: this.learnerKeyOf(identity) };
  }

  /**
   * For a request that resumes a launch: looks the account up without writing.
   * @param identity - The stored launch's issuer, sub, platform and roles.
   * @returns The account, or undefined when it no longer exists (e.g. purged).
   */
  async forRequest(identity: LtiIdentity): Promise<LtiAccount | undefined> {
    const source = pseudonymSource({ kind: 'lti', issuer: identity.issuer, subject: identity.subject });
    const userId = await this.deps.accounts.lookup('lti', source);
    return userId ? { userId, learnerKey: this.learnerKeyOf(identity) } : undefined;
  }
}
