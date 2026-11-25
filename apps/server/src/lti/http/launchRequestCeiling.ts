/**
 * launchRequestCeiling — a ceiling on how many requests one network address may send to ltijs's routes (login,
 * launch, key set) in a minute.
 *
 * Why: these routes answer before anyone is signed in. A login request makes the server store a nonce and sign
 *      two tokens, and a launch reads the database and checks signatures, so an address that sends requests
 *      without end chooses how much work the server does. A reverse proxy should limit this first (the question
 *      to HVL IT in docs/assurance/threat-model.md); this is the application's own backstop (D-141).
 * Spec: LTI-001, NFR-006
 * Invariants:
 *   - One fixed window of a minute per address, counted in Redis so every server node shares it. The number is
 *     far above real use: a launch is three requests, and a whole campus behind one address launches hundreds
 *     of times a minute at most.
 *   - Past the ceiling: 429 `hvl:rate-limited` with `Retry-After`, as an LTI error page, before the body is read.
 *   - PRIVACY: the address is never a key. The key is its keyed fingerprint under the identity key ring
 *     (`auth-audit-ip`, as the audit log stores it), and it expires with its minute.
 *   - Redis unreachable: the request goes ahead and one line a minute says so. This ceiling is a backstop, never
 *     the thing that lets a person in, so it does not make a launch depend on Redis.
 * Collaborators: ./ExpressRouterHttpHandler.ts (runs it ahead of every ltijs route), ../LtiProviderFactory.ts,
 *   ../../learningDesign/collaboration/PersonRateLimit.ts (the counter), ./ltiErrorPages.ts (the page).
 * Tests: apps/server/test/lti/http/launchRequestCeiling.int.test.ts
 */
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit } from '../../learningDesign/collaboration/PersonRateLimit.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';

/** Requests one address may send to ltijs's routes in a minute: 2 000 launches of three requests each. */
export const LAUNCH_REQUESTS_PER_MINUTE = 6000;

const WINDOW_SECONDS = 60;

/** What the ceiling needs. */
export interface LaunchRequestCeilingDeps {
  /** The server's Redis client (not owned: the server closes it). */
  readonly redis: Redis;
  /** Makes the address's fingerprint. */
  readonly hasher: Pick<IdentityHasher, 'hash'>;
  readonly logger: Pick<Logger, 'warn'>;
  /** `LAUNCH_REQUESTS_PER_MINUTE` unless a test lowers it. */
  readonly limit?: number;
}

/**
 * The fingerprint a client address is counted under.
 * @param hasher - The identity hasher.
 * @param ip - The address as Express resolved it (`req.ip`).
 * @returns The keyed hash; requests without an address share one.
 */
export const addressFingerprint = (hasher: Pick<IdentityHasher, 'hash'>, ip: string | undefined): string =>
  hasher.hash('auth-audit-ip', ip ?? 'no-address').hash;

/**
 * Builds the middleware that counts a request to an ltijs route and refuses it past the ceiling.
 * @param deps - Redis, the hasher, the logger and, for tests, a lower limit.
 * @returns An Express middleware to run before the body parser.
 * @spec LTI-001
 */
export function launchRequestCeiling(deps: LaunchRequestCeilingDeps): RequestHandler {
  const counter = new PersonRateLimit(deps.redis, {
    keyPrefix: 'hvli:lti-requests:',
    limit: deps.limit ?? LAUNCH_REQUESTS_PER_MINUTE,
    windowSeconds: WINDOW_SECONDS,
  });
  let saidUnavailableAt = 0;
  return async (req, res, next) => {
    let decision: Awaited<ReturnType<PersonRateLimit['take']>>;
    try {
      decision = await counter.take(addressFingerprint(deps.hasher, req.ip));
    } catch {
      // WHY: a backstop must not turn a Redis fault into a failed launch; the fault is said once a minute.
      if (Date.now() - saidUnavailableAt >= WINDOW_SECONDS * 1000) {
        saidUnavailableAt = Date.now();
        deps.logger.warn({}, 'LTI request ceiling not counted: Redis unreachable');
      }
      next();
      return;
    }
    if (decision.allowed) {
      next();
      return;
    }
    res.set('Retry-After', String(decision.retryAfterSeconds));
    next(learningDesignError('hvl:rate-limited'));
  };
}
