/**
 * GradeSyncWorker — sends queued formative scores to the Canvas gradebook about every 15 seconds, on one server node
 * per interval.
 *
 * Why: LTI-012 needs a durable worker so that learning never waits for Canvas and a failed send is retried after the
 *      page is closed. SPEC-DEVIATION: D-104 — the worker uses our own AGS client (./AgsScoreClient.ts) with its own
 *      client-credentials token, not ltijs's `context.grading.submitScore`, which needs a live ltik. A Redis lease
 *      (../jobs/LeasedIntervalJob.ts) runs it on one node at a time, and its claims keep overlapping runs apart.
 * Spec: LTI-012
 * Invariants:
 *   - Each tick reads the injectable clock once and runs `runGradeSync` at that moment; a test calls `runOnce(now)`.
 *   - Only counts reach the log (LeasedIntervalJob drops anything else a run returns).
 *   - The token source lives as long as the worker, so a token is reused across ticks until shortly before it expires.
 * Collaborators: ./gradeSyncRun.ts, ./AgsAccessTokens.ts, ./AgsScoreClient.ts, ../jobs/LeasedIntervalJob.ts,
 *   ../server/main.ts (starts and stops it), ltijs's `Provider.platformManager` (the tool key, D-056).
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts
 */
import type { Redis } from '../infra/redisClient.js';
import type { JobClock } from '../jobs/jobClock.js';
import { LeasedIntervalJob } from '../jobs/LeasedIntervalJob.js';
import { AgsAccessTokens, type AgsPlatformDirectory } from './AgsAccessTokens.js';
import { AgsScoreClient, type AgsScoreSender } from './AgsScoreClient.js';
import { runGradeSync, type GradeSyncRunDeps } from './gradeSyncRun.js';

/** About every 15 seconds (D-104). */
export const GRADE_SYNC_INTERVAL_MS = 15_000;
/** Redis key of the worker's lease. */
export const GRADE_SYNC_LEASE_KEY = 'hvli:grades:sync';

/** Inputs of the worker. */
export interface GradeSyncWorkerOptions extends Omit<GradeSyncRunDeps, 'sender'> {
  /** Redis client that holds the lease. */
  readonly redis: Pick<Redis, 'set'>;
  /** The score sender; by default our AGS client over `platforms`. */
  readonly sender?: AgsScoreSender;
  /** ltijs's platform manager, for the tool key; needed when no `sender` is given. */
  readonly platforms?: AgsPlatformDirectory;
  /** Time between runs; defaults to 15 seconds. */
  readonly intervalMs?: number;
  /** The clock read once per tick; tests pass a fixed one. */
  readonly clock?: JobClock;
}

/**
 * The default score sender: our AGS client with a token source over ltijs's platform manager.
 * @param platforms - `Provider.platformManager`.
 * @returns A sender that keeps its tokens between calls.
 */
export const agsScoreSender = (platforms: AgsPlatformDirectory): AgsScoreSender =>
  new AgsScoreClient(new AgsAccessTokens({ platforms }));

/** The grade passback worker (LTI-012, D-104). */
export class GradeSyncWorker extends LeasedIntervalJob {
  /**
   * @param options - Database, Redis, encryption, logger, the platforms or a sender, and optional settings.
   * @throws Error when neither `sender` nor `platforms` is given (a wiring fault).
   */
  constructor(options: GradeSyncWorkerOptions) {
    const sender = options.sender ?? (options.platforms ? agsScoreSender(options.platforms) : undefined);
    if (!sender) throw new Error('the grade worker needs a score sender or the LTI platforms');
    const deps: GradeSyncRunDeps = { ...options, sender };
    super({
      name: 'grade-sync',
      label: 'grade sync',
      leaseKey: GRADE_SYNC_LEASE_KEY,
      intervalMs: options.intervalMs ?? GRADE_SYNC_INTERVAL_MS,
      redis: options.redis,
      run: async (now) => ({ ...(await runGradeSync(deps, now)) }),
      logger: options.logger,
      ...(options.clock ? { clock: options.clock } : {}),
    });
  }
}
