/**
 * ltiAccount — the account and the learner pseudonym behind an LTI launch, and behind every later request that
 * resumes it with its ltik.
 *
 * Why: a Canvas user is known by the platform registration (issuer and client ID) and `sub`: every hosted Canvas
 *      sends the same issuer, so the issuer alone does not say whose `sub` it is (D-129). Learners get
 *      pseudonymous User rows (D-034) found by identity hash (D-055), and their H5P state is keyed by the yearly
 *      learnerKey (DATA-002). The launch may create the account; a resumed request only looks it up, so it
 *      writes nothing.
 * Spec: LTI-001, DATA-002, LTI-004, DATA-003
 * Invariants:
 *   - The `sub` is used in memory only: hashed for the identity, HMAC'd for the learnerKey, never stored.
 *   - The account and the learnerKey come from one source text, `lti|<iss>|<client-id>|<sub>`, so the same `sub`
 *     from two registrations is two people, also when both send one issuer (D-129).
 *   - LTI accounts carry no profile: Canvas names and e-mail are never stored (AUTH-004, privacy_level anonymous).
 *   - An author launch makes the account `staff`; it is never made admin here (LTI-004).
 *   - The learnerKey and its academic year come from one moment, so a request at the turn of the year (1 August,
 *     Oslo time) never pairs a key with the other year (D-107).
 * Collaborators: ../../auth/identity/AccountResolver.ts, ../../privacy/deriveLearnerKey.ts, ./onResourceLink.ts,
 *   ../ltikPrincipal.ts.
 * Tests: apps/server/test/lti/launch/ltiAccount.int.test.ts
 */
import type { AccountResolver } from '../../auth/identity/AccountResolver.js';
import type { Role } from '../../auth/Principal.js';
import { academicYearOf } from '../../privacy/academicYear.js';
import { deriveLearnerKey, pseudonymSource, type LearnerSource } from '../../privacy/deriveLearnerKey.js';
import type { PseudonymSecrets } from '../../privacy/pseudonymSecrets.js';

/** Who launched, as the launch's claims say. */
export interface LtiIdentity {
  /** The platform's `iss`. */
  readonly issuer: string;
  /** The client ID of the registration the launch was validated against. */
  readonly clientId: string;
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
  /** The academic year of the secret behind `learnerKey` (D-107). */
  readonly learnerKeyYear: number;
}

/** The one source both the identity hash and the learnerKey of a launch are made from (D-129). */
const sourceOf = ({ issuer, clientId, subject }: LtiIdentity): LearnerSource => ({
  kind: 'lti',
  issuer,
  clientId,
  subject,
});

/** Resolves LTI accounts. */
export class LtiAccounts {
  /**
   * @param deps - The account resolver, the pseudonym secrets and a clock.
   */
  constructor(
    private readonly deps: { accounts: AccountResolver; secrets: PseudonymSecrets; now?: () => Date },
  ) {}

  private learnerKeyOf(identity: LtiIdentity): Pick<LtiAccount, 'learnerKey' | 'learnerKeyYear'> {
    const now = (this.deps.now ?? (() => new Date()))();
    return {
      learnerKey: deriveLearnerKey(sourceOf(identity), this.deps.secrets, now),
      learnerKeyYear: academicYearOf(now),
    };
  }

  /**
   * At a launch: finds or creates the account.
   * @param identity - The launch's issuer, client ID, sub, platform and roles.
   * @returns The account, the learnerKey and its academic year.
   */
  async atLaunch(identity: LtiIdentity): Promise<LtiAccount> {
    const { userId } = await this.deps.accounts.resolve({
      provider: 'lti',
      source: pseudonymSource(sourceOf(identity)),
      platformId: identity.platformId,
      kind: identity.roles.includes('author') ? 'staff' : 'learner',
    });
    return { userId, ...this.learnerKeyOf(identity) };
  }

  /**
   * For a request that resumes a launch: looks the account up without writing.
   * @param identity - The stored launch's issuer, client ID, sub, platform and roles.
   * @returns The account, or undefined when it no longer exists (e.g. purged).
   */
  async forRequest(identity: LtiIdentity): Promise<LtiAccount | undefined> {
    const userId = await this.deps.accounts.lookup('lti', pseudonymSource(sourceOf(identity)));
    return userId ? { userId, ...this.learnerKeyOf(identity) } : undefined;
  }
}
