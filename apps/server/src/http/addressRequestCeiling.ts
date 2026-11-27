/**
 * addressRequestCeiling — a ceiling on how many requests one network address may send in a minute to a group of
 * routes that answer before anyone is signed in.
 *
 * Why: such a route works for whoever asks. ltijs's login stores a nonce and signs two tokens; a Feide login stores
 *      a pending login and may ask Feide for its settings; a callback reads Redis and can write to the audit log. An
 *      address that sends requests without end chooses how much of that the server does. A reverse proxy should
 *      limit this first (the question to HVL IT in docs/assurance/threat-model.md); this is the application's own
 *      backstop (D-141 for ltijs's routes, D-150 for the Feide login).
 * Spec: NFR-006, LTI-001, AUTH-001
 * Invariants:
 *   - One fixed window of a minute per address and group of routes, counted in Redis so every server node shares
 *     it. A group's number is far above real use, since a whole campus can sit behind one address.
 *   - Past the ceiling the request is refused with 429 `hvl:rate-limited` and `Retry-After`, before its route runs
 *     and before a body is read.
 *   - PRIVACY: the address is never a key. The key is its keyed fingerprint under the identity key ring
 *     (`auth-audit-ip`, as the audit log stores it), and it expires with its minute.
 *   - Redis unreachable: the request goes ahead and one line a minute says so. The ceiling is a backstop, never the
 *     thing that lets a person in, so a Redis fault is never the ceiling's reason to refuse anyone.
 * Collaborators: ../lti/http/launchRequestCeiling.ts and ../auth/feide/loginRequestCeiling.ts (the two groups),
 *   ../learningDesign/collaboration/PersonRateLimit.ts (the counter), ./learningDesignErrors.ts (the refusal).
 * Tests: apps/server/test/lti/http/launchRequestCeiling.int.test.ts,
 *   apps/server/test/auth/feide/feideLoginCeiling.int.test.ts
 */
import type { NextFunction, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import type { Redis } from '../infra/redisClient.js';
import { PersonRateLimit } from '../learningDesign/collaboration/PersonRateLimit.js';
import type { IdentityHasher } from '../security/keys/IdentityHasher.js';
import type { HttpError } from './HttpError.js';
import { learningDesignError } from './learningDesignErrors.js';

const WINDOW_SECONDS = 60;

/** What every ceiling needs. */
export interface AddressRequestCeilingDeps {
  /** The server's Redis client (not owned: the server closes it). */
  readonly redis: Redis;
  /** Makes the address's fingerprint. */
  readonly hasher: Pick<IdentityHasher, 'hash'>;
  /** Says, once a minute, that Redis is unreachable and requests are not counted. */
  readonly logger: Pick<Logger, 'warn'>;
}

/** One group of routes and its ceiling. */
export interface AddressRequestGroup {
  /** The Redis key prefix of the group's counters, e.g. `hvli:lti-requests:`. */
  readonly keyPrefix: string;
  /** Requests one address may send to the group in a minute. */
  readonly limit: number;
  /** What the log line calls the ceiling, e.g. `LTI request ceiling`. */
  readonly name: string;
  /**
   * Answers a refused request; the default hands the error to the next error handler.
   * @param error - The 429 `hvl:rate-limited` error.
   * @param res - The response, with `Retry-After` set.
   * @param next - Express's next function.
   */
  readonly refuse?: (error: HttpError, res: Response, next: NextFunction) => void;
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
 * Builds the middleware that counts a request to a group of routes and refuses it past the group's ceiling.
 * @param deps - Redis, the hasher and the logger.
 * @param group - The group's key prefix, number, name and, when it has its own error page, how it refuses.
 * @returns An Express middleware to run before the group's routes and before any body parser.
 * @spec NFR-006
 */
export function addressRequestCeiling(
  deps: AddressRequestCeilingDeps,
  group: AddressRequestGroup,
): RequestHandler {
  const counter = new PersonRateLimit(deps.redis, {
    keyPrefix: group.keyPrefix,
    limit: group.limit,
    windowSeconds: WINDOW_SECONDS,
  });
  const refuse = group.refuse ?? ((error, _res, next) => next(error));
  let saidUnavailableAt = 0;
  return async (req, res, next) => {
    let decision: Awaited<ReturnType<PersonRateLimit['take']>>;
    try {
      decision = await counter.take(addressFingerprint(deps.hasher, req.ip));
    } catch {
      // WHY: a backstop must not turn a Redis fault into a failed login or launch; the fault is said once a minute.
      if (Date.now() - saidUnavailableAt >= WINDOW_SECONDS * 1000) {
        saidUnavailableAt = Date.now();
        deps.logger.warn({}, `${group.name} not counted: Redis unreachable`);
      }
      next();
      return;
    }
    if (decision.allowed) {
      next();
      return;
    }
    res.set('Retry-After', String(decision.retryAfterSeconds));
    refuse(learningDesignError('hvl:rate-limited'), res, next);
  };
}
