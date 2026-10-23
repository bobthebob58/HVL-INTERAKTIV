/**
 * LtiRecordCleanupJob — deletes expired ltijs records every 10 minutes, on exactly one node per interval.
 *
 * Why: launch ID tokens (24 hours), OIDC nonces (10 minutes) and platform access tokens (until `expires_in`)
 *      must not outlive their use (LTI-002, D-052); the storage already ignores expired rows, and this job removes
 *      them. A Redis lease (../../jobs/LeasedIntervalJob.ts) keeps the work to one node per interval.
 * Spec: LTI-002, DATA-002
 * Invariants:
 *   - Deletes `LtiIdToken` rows whose `expiresAt` has passed, `LtiNonce` rows created more than 10 minutes ago
 *     and `LtiAccessToken` rows whose `expiresAt` has passed; nothing else.
 *   - Uses the same lifetimes as the storage (./ltiRecordLifetimes.ts) and an injectable clock.
 *   - A row outlives its lifetime by at most one interval (10 minutes); the storage never returns it in that time.
 *   - Logs only the number of rows deleted.
 * Collaborators: ../../jobs/LeasedIntervalJob.ts, ./PrismaLtiDatabaseManager.ts (writes the rows),
 *   the server entry point (starts and stops the job).
 * Tests: apps/server/test/lti/storage/LtiRecordCleanupJob.test.ts,
 *   apps/server/test/lti/storage/LtiRecordCleanupJob.int.test.ts
 */
import type { Logger } from 'pino';
import type { Database } from '../../infra/prismaClient.js';
import type { Redis } from '../../infra/redisClient.js';
import { LeasedIntervalJob } from '../../jobs/LeasedIntervalJob.js';
import { NONCE_LIFETIME_MS } from './ltiRecordLifetimes.js';

/** Default interval: 10 minutes (D-052). */
export const LTI_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
/** Redis key of the lease. */
export const LTI_CLEANUP_LEASE_KEY = 'hvli:lti:record-cleanup';

/** The tables the job deletes from. */
type LtiRecordTables = Pick<Database, 'ltiIdToken' | 'ltiNonce' | 'ltiAccessToken'>;

/** How many rows of each kind one run deleted. */
export interface LtiCleanupCounts {
  readonly idTokens: number;
  readonly nonces: number;
  readonly accessTokens: number;
}

/** Inputs of the job. */
export interface LtiRecordCleanupOptions {
  /** The server's Prisma client. */
  readonly db: LtiRecordTables;
  /** Redis client that holds the lease. */
  readonly redis: Pick<Redis, 'set'>;
  /** Logger for outcomes and failures. */
  readonly logger: Logger;
  /** Time between runs; defaults to 10 minutes. */
  readonly intervalMs?: number;
  /** The clock; tests pass a fixed one. Defaults to the system clock. */
  readonly now?: () => Date;
}

/**
 * Deletes every expired ID token, nonce and access token.
 * @param db - The database.
 * @param now - The current time.
 * @returns How many rows of each kind were deleted.
 * @spec LTI-002
 */
export async function deleteExpiredLtiRecords(db: LtiRecordTables, now: Date): Promise<LtiCleanupCounts> {
  const nonceCutoff = new Date(now.getTime() - NONCE_LIFETIME_MS);
  // PRIVACY: ID tokens hold the learner's LTI `sub`; unreadable after 24 hours, deleted at most 10 minutes later (DATA-002, D-052).
  const [idTokens, nonces, accessTokens] = await Promise.all([
    db.ltiIdToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.ltiNonce.deleteMany({ where: { createdAt: { lte: nonceCutoff } } }),
    db.ltiAccessToken.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
  return { idTokens: idTokens.count, nonces: nonces.count, accessTokens: accessTokens.count };
}

/** Periodic, cluster-wide single-run cleanup of expired ltijs records. */
export class LtiRecordCleanupJob extends LeasedIntervalJob {
  /**
   * @param options - Database, Redis client, logger, and an optional interval and clock.
   */
  constructor(options: LtiRecordCleanupOptions) {
    const now = options.now ?? (() => new Date());
    super({
      name: 'lti-record-cleanup',
      label: 'LTI record cleanup',
      leaseKey: LTI_CLEANUP_LEASE_KEY,
      intervalMs: options.intervalMs ?? LTI_CLEANUP_INTERVAL_MS,
      redis: options.redis,
      run: async () => ({ ...(await deleteExpiredLtiRecords(options.db, now())) }),
      logger: options.logger,
    });
  }
}
