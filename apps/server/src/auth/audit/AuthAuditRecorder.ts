/**
 * AuthAuditRecorder — writes login, logout, author-launch and account-linking events to `AuthAuditEvent`.
 *
 * Why: D-064 requires an audit trail for authentication with the client address kept only as a keyed hash, so abuse
 *      can be grouped by address without storing the address (DATA-007, DATA-002). Learner LTI launches are not
 *      recorded (minimisation).
 * Spec: DATA-007, AUTH-001, LTI-001, AUTH-005
 * Invariants:
 *   - Event names and reasons come from fixed lists; no free text, name, Feide ID, LTI sub or token is stored.
 *   - The IP address is stored only as HMAC-SHA256 under the identity key ring's `auth-audit-ip` purpose, with the
 *     key's ID (D-055).
 *   - A failure to record never fails the login or launch it describes; it is logged without personal data.
 * Collaborators: ../../security/keys/IdentityHasher.ts, ../feide/completeFeideLogin.ts, ../../lti/launch/.
 * Tests: apps/server/test/auth/audit/AuthAuditRecorder.int.test.ts
 */
import type { Logger } from 'pino';
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';

/** Audited authentication events (D-064). */
export const AUTH_AUDIT_EVENTS = [
  'login.feide',
  'login.feide.failed',
  'logout',
  'launch.lti.author',
  'launch.lti.failed',
  'link.attached',
  'link.moved',
  'link.conflict',
] as const;
/** One audited event name. */
export type AuthAuditEventName = (typeof AUTH_AUDIT_EVENTS)[number];

/** Fixed reason codes for failures and link outcomes. */
export const AUTH_AUDIT_REASONS = [
  'state-invalid',
  'token-invalid',
  'no-feide-id',
  'groups-unavailable',
  'platform-unknown',
  'platform-inactive',
  'deployment-not-allowed',
  'nonce-invalid',
  'launch-invalid',
  'lti-account-owns-content',
] as const;
/** One reason code. */
export type AuthAuditReason = (typeof AUTH_AUDIT_REASONS)[number];

/** What is recorded. */
export interface AuthAuditInput {
  /** The event. */
  readonly event: AuthAuditEventName;
  /** The internal user ID, when known. */
  readonly actorUserId?: string;
  /** Why a failure or link outcome happened. */
  readonly reason?: AuthAuditReason;
  /** The client address as Express resolved it (`req.ip`); hashed before storage. */
  readonly ip?: string;
}

/** Records authentication events. */
export class AuthAuditRecorder {
  /**
   * @param deps - The database, the identity hasher and the logger.
   */
  constructor(private readonly deps: { db: Database; hasher: IdentityHasher; logger: Logger }) {}

  /**
   * Records one event; never throws.
   * @param input - Event, actor, reason and client address.
   */
  async record(input: AuthAuditInput): Promise<void> {
    // PRIVACY: only a keyed hash of the address is stored (DATA-002, D-055).
    const ip = input.ip ? this.deps.hasher.hash('auth-audit-ip', input.ip) : undefined;
    try {
      await this.deps.db.authAuditEvent.create({
        data: {
          event: input.event,
          actorUserId: input.actorUserId ?? null,
          reason: input.reason ?? null,
          ipHash: ip?.hash ?? null,
          ipKeyId: ip?.keyId ?? null,
        },
      });
    } catch (error) {
      // WHY: an audit write that fails must not lock people out; the failure itself is logged.
      this.deps.logger.error({ err: error, event: input.event }, 'auth audit event not recorded');
    }
  }
}
