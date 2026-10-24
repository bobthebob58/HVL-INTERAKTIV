/**
 * ContentWriteLock — lets one save or one publish of an activity run at a time, on every server node.
 *
 * Why: the save gate reads the status and then Lumi writes the parameters several awaits later; the publish reads and
 *      validates the stored activity and then commits. Without a lock, a publish could commit between the gate's
 *      read and Lumi's write, and learners would see a save nobody validated (PROD-003, D-074). A PostgreSQL lock
 *      would hold a pooled connection for the whole Lumi save, which itself needs connections from the same pool;
 *      a Redis lease (`SET NX PX`, as ../jobs/LeasedIntervalJob.ts does) holds none.
 * Spec: PROD-003
 * Invariants:
 *   - The key is `hvli:content:write-lock:<contentId>` with the ID in lower case (`writeLockKey`), in Redis and in
 *     the in-process lock alike: a save passes the request path's spelling, which may be upper case, a publish the
 *     stored ID, and both name the same activity (`isContentUuid` accepts either case, PostgreSQL too).
 *   - The key's value is a random token; only the holder that set the token deletes the key (compare-and-delete), so
 *     a holder whose lease ran out never frees someone else's lock.
 *   - A caller waits at most `waitMs`; then it gets 409 `hvl:content-changed` (the activity is being changed).
 *   - The lease ends by itself after `leaseMs`, so a node that dies cannot block an activity for longer.
 *     It is far longer than a save needs from the gate's read to Lumi's write of the parameters, which is all
 *     the lock must cover: once they are written, a publish validates them.
 *   - An error answer from Redis while taking the lock rejects (nothing is saved or published); one while freeing
 *     it is ignored, because the lease ends by itself and the save or publish already happened. While the client
 *     reconnects, its offline queue holds the command, so the caller waits for Redis (as the Redis-backed session
 *     and H5P cache on the same request already do) rather than failing fast.
 *   - `IN_PROCESS_WRITE_LOCK` serialises within one process only; createApp passes the Redis lock.
 * Collaborators: ./PublishedSaveGate.ts, ./ContentPublisher.ts, ./publishingDeps.ts, ../server/createApp.ts,
 *   ../infra/redisClient.ts.
 * Tests: apps/server/test/content/ContentWriteLock.int.test.ts, apps/server/test/content/saveRace.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { authError } from '../http/authErrors.js';
import type { Redis } from '../infra/redisClient.js';

/** Runs work while no other save or publish of the same activity runs. */
export interface ContentWriteLock {
  /**
   * Runs `work` while holding the activity's lock.
   * @param contentId - The activity.
   * @param work - The save or publish.
   * @returns What `work` returns.
   * @throws HttpError 409 `hvl:content-changed` when the lock stays taken for longer than the wait.
   */
  hold<T>(contentId: string, work: () => Promise<T>): Promise<T>;
}

/** How long a lease lasts, how long a caller waits for it, and how often it asks. */
export interface WriteLockTiming {
  readonly leaseMs: number;
  readonly waitMs: number;
  readonly pollMs: number;
}

/** Prefix of the lock keys in Redis. */
export const WRITE_LOCK_PREFIX = 'hvli:content:write-lock:';

/**
 * Names an activity's lock, whatever letter case the caller spells its ID in.
 * @param contentId - The activity ID, from a request path or from the database.
 * @returns The Redis key, with the ID in lower case.
 */
export const writeLockKey = (contentId: string): string => WRITE_LOCK_PREFIX + contentId.toLowerCase();

/** A minute of lease; half a minute of waiting, so a waiting request answers before a 60-second proxy timeout. */
export const DEFAULT_WRITE_LOCK_TIMING: WriteLockTiming = { leaseMs: 60_000, waitMs: 30_000, pollMs: 50 };

const RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** The lock on Redis, shared by every node. */
export class RedisContentWriteLock implements ContentWriteLock {
  /**
   * @param redis - The shared Redis client.
   * @param timing - Lease, wait and poll interval; the defaults outside tests.
   */
  constructor(
    private readonly redis: Pick<Redis, 'set' | 'eval'>,
    private readonly timing: WriteLockTiming = DEFAULT_WRITE_LOCK_TIMING,
  ) {}

  /** Takes the lease (waiting up to `waitMs`), runs the work, and frees the lease if it is still this caller's. */
  async hold<T>(contentId: string, work: () => Promise<T>): Promise<T> {
    const key = writeLockKey(contentId);
    const token = randomUUID();
    const deadline = Date.now() + this.timing.waitMs;
    while ((await this.redis.set(key, token, { NX: true, PX: this.timing.leaseMs })) !== 'OK') {
      if (Date.now() >= deadline) throw authError('hvl:content-changed');
      await delay(this.timing.pollMs);
    }
    try {
      return await work();
    } finally {
      // WHY: the lease ends by itself; a failed release must not turn a finished save into an error answer.
      await this.redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] }).catch(() => undefined);
    }
  }
}

/** The lock within one process: each activity's holders run one after the other. */
export class InProcessContentWriteLock implements ContentWriteLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  /** Runs the work after every earlier holder of the same activity has finished. */
  async hold<T>(contentId: string, work: () => Promise<T>): Promise<T> {
    const key = writeLockKey(contentId);
    const run = (this.tails.get(key) ?? Promise.resolve()).then(work);
    const tail = run.catch(() => undefined);
    this.tails.set(key, tail);
    try {
      return await run;
    } finally {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}

/** The process-wide lock used when no lock is passed in (tests and single-process tools). */
export const IN_PROCESS_WRITE_LOCK: ContentWriteLock = new InProcessContentWriteLock();
