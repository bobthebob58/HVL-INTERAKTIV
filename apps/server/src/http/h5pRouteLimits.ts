/**
 * h5pRouteLimits — the per-person limits of the H5P routes: how often a learner's state may be saved for one
 * activity, how many files and packages an author may send, how many activities an author may create, and how
 * many SVG files of an author may be refused as too complex before further ones must wait.
 *
 * Why: every one of these requests costs the server work and storage that the person chooses the amount of. A
 *      real activity saves twelve times a minute, and an author sends a handful of files; the limits are far above
 *      that and bound what one person can ask for (D-120). The SVG rule keeps one person from holding the SVG
 *      cleaning worker, which cleans one file at a time (D-119), busy for everyone else. New activities are
 *      counted too, with the ones made from a pattern (D-128).
 * Spec: H5P-005, SEC-005, SEC-001
 * Invariants:
 *   - Counters live in Redis, so the limits hold across server nodes; a counter is a number under a key that names
 *     an account ID (and for saves an activity ID), never content (docs/privacy/DATA-INVENTORY.md).
 *   - Past a limit the answer is 429 `hvl:rate-limited` with `Retry-After`, before the request's body is read.
 *   - Redis being unreachable fails the request; a limit is never skipped.
 * Collaborators: ../learningDesign/collaboration/PersonRateLimit.ts (the fixed-window counter),
 *   ./routes/userDataRoutes.ts, ./routes/ajaxRoutes.ts, ../h5p/createH5pRuntime.ts (builds them),
 *   ../h5p/storage/learnerStateLimits.ts (the save limit's number).
 * Tests: apps/server/test/http/userDataLimits.int.test.ts, apps/server/test/http/uploadLimits.int.test.ts,
 *   apps/server/test/http/creationLimit.int.test.ts
 */
import type { Response } from 'express';
import { STATE_SAVES_PER_MINUTE } from '../h5p/storage/learnerStateLimits.js';
import type { GateLimits } from '../infra/BoundedGate.js';
import type { Redis } from '../infra/redisClient.js';
import {
  PersonRateLimit,
  type PersonLimit,
  type RateDecision,
} from '../learningDesign/collaboration/PersonRateLimit.js';
import { learningDesignError } from './learningDesignErrors.js';

const TEN_MINUTES = 600;
/** Editor file uploads one author may send in ten minutes. */
export const UPLOADS_PER_TEN_MINUTES = 120;
/** Package imports one author may send in ten minutes. */
export const IMPORTS_PER_TEN_MINUTES = 20;
/** SVG files of one author that may be refused as too complex in ten minutes before further SVGs wait. */
export const SLOW_SVGS_PER_TEN_MINUTES = 3;
/** Activities one author may create in ten minutes: new ones in the editor and ones from a pattern together. */
export const CREATIONS_PER_TEN_MINUTES = 60;

/** A count of events that is checked before an action and raised only when the event happens. */
export interface PersonBudget {
  /**
   * Tells whether the person's budget is spent.
   * @param userId - The account.
   * @returns Allowed, or refused with the seconds until the window ends.
   */
  check(userId: string): Promise<RateDecision>;
  /**
   * Counts one event of the person.
   * @param userId - The account.
   */
  spend(userId: string): Promise<void>;
}

/** The limits of the H5P routes. */
export interface H5pRouteLimits {
  /** Saves of one learner's state for one activity; the ID is `<account ID>:<activity ID>`. */
  readonly stateSaves: PersonLimit;
  /** How many state saves one process handles at once and lets wait; D-134's limits when not given. */
  readonly stateSaveGate?: GateLimits;
  /** Editor file uploads of one author. */
  readonly uploads: PersonLimit;
  /** Package imports of one author. */
  readonly imports: PersonLimit;
  /** New activities of one author (D-128). */
  readonly creations: PersonLimit;
  /** SVG uploads of one author that the cleaning refused as too complex (D-119). */
  readonly slowSvgs: PersonBudget;
}

/** A budget in Redis, in fixed windows that start with the first event. */
class RedisPersonBudget implements PersonBudget {
  constructor(
    private readonly redis: Redis,
    private readonly shape: { keyPrefix: string; limit: number; windowSeconds: number },
  ) {}

  async check(userId: string): Promise<RateDecision> {
    const key = this.shape.keyPrefix + userId;
    const [count, ttl] = await this.redis.multi().get(key).ttl(key).exec();
    if (Number(count ?? 0) < this.shape.limit) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Number(ttl)) };
  }

  async spend(userId: string): Promise<void> {
    const key = this.shape.keyPrefix + userId;
    // WHY: INCR and EXPIRE NX in one MULTI: the first event of a window sets its end, later ones never move it.
    await this.redis.multi().incr(key).expire(key, this.shape.windowSeconds, 'NX').exec();
  }
}

/**
 * The limit on new activities of one author, shared by the editor's save of a new activity and the creation from
 * a pattern: both count under one key.
 * @param redis - The server's Redis client (not owned: the server closes it).
 * @returns The limit with D-128's number.
 * @spec PROD-007
 */
export const creationLimit = (redis: Redis): PersonLimit =>
  new PersonRateLimit(redis, {
    keyPrefix: 'hvli:creations:',
    limit: CREATIONS_PER_TEN_MINUTES,
    windowSeconds: TEN_MINUTES,
  });

/**
 * Builds the limits on the server's Redis.
 * @param redis - The server's Redis client (not owned: the server closes it).
 * @returns The limits with D-120's and D-128's numbers.
 */
export function createH5pRouteLimits(redis: Redis): H5pRouteLimits {
  const window = (keyPrefix: string, limit: number, windowSeconds: number) =>
    new PersonRateLimit(redis, { keyPrefix, limit, windowSeconds });
  return {
    stateSaves: window('hvli:state-saves:', STATE_SAVES_PER_MINUTE, 60),
    uploads: window('hvli:uploads:', UPLOADS_PER_TEN_MINUTES, TEN_MINUTES),
    imports: window('hvli:imports:', IMPORTS_PER_TEN_MINUTES, TEN_MINUTES),
    creations: creationLimit(redis),
    slowSvgs: new RedisPersonBudget(redis, {
      keyPrefix: 'hvli:svg-too-complex:',
      limit: SLOW_SVGS_PER_TEN_MINUTES,
      windowSeconds: TEN_MINUTES,
    }),
  };
}

/**
 * Answers a decision of a limit: nothing when allowed, else 429 with `Retry-After`.
 * @param decision - From a limit's `take` or a budget's `check`; undefined where no limit is configured.
 * @param res - The response, for the header.
 * @throws HttpError 429 `hvl:rate-limited` when the decision refuses.
 */
export function refuseWhenLimited(decision: RateDecision | undefined, res: Response): void {
  if (!decision || decision.allowed) return;
  res.set('Retry-After', String(decision.retryAfterSeconds));
  throw learningDesignError('hvl:rate-limited');
}
