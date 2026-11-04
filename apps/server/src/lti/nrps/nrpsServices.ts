/**
 * nrpsServices — builds the NRPS learner count from the server's clients: the counter a resource-link launch starts
 * and the reader insight takes its denominator from.
 *
 * Why: LTI-008 needs the same Redis store on both sides (the launch writes, insight reads, INS-001) and ltijs's token
 *      cache for the one retry after a 401. One builder keeps the app's wiring to a single call.
 * Spec: LTI-008, INS-001
 * Invariants:
 *   - The counter and the reader share one `NrpsLearnerCountStore`; the reader can only read.
 *   - Nothing here owns a client: the server closes Redis and the database.
 * Collaborators: ./NrpsLearnerCounter.ts, ./NrpsLearnerCountStore.ts, ./nrpsTokenCache.ts, ../ltiRoutes.ts (passes
 *   the counter to ../launch/onResourceLink.ts), the insight denominators (S6 step 4, `counts.read`).
 * Tests: apps/server/test/lti/nrps/NrpsLearnerCounter.int.test.ts
 */
import type { Logger } from 'pino';
import type { Database } from '../../infra/prismaClient.js';
import type { Redis } from '../../infra/redisClient.js';
import { NrpsLearnerCounter } from './NrpsLearnerCounter.js';
import { NrpsLearnerCountStore } from './NrpsLearnerCountStore.js';
import { forgetNrpsToken } from './nrpsTokenCache.js';

/** What the NRPS count needs from the server. */
export interface NrpsServiceDeps {
  readonly db: Database;
  readonly redis: Redis;
  readonly logger: Pick<Logger, 'info' | 'warn'>;
  /** `NRPS_MAX_PAGES`. */
  readonly maxPages: number;
}

/** The two sides of the NRPS learner count. */
export interface NrpsServices {
  /** Counts a course after a launch; pass it to `onResourceLink` as `nrps` (LTI-008). */
  readonly counter: NrpsLearnerCounter;
  /** Reads a course's latest count by D-103's `<platformId>:<contextId>`: insight's denominator (INS-001). */
  readonly counts: Pick<NrpsLearnerCountStore, 'read'>;
}

/**
 * Builds the NRPS learner count.
 * @param deps - The database (ltijs's token cache), Redis (the counts), a logger and `NRPS_MAX_PAGES`.
 * @returns The counter and the reader.
 * @example
 * const nrps = createNrpsServices({ db, redis, logger, maxPages: env.NRPS_MAX_PAGES });
 * onResourceLink({ ...deps, nrps: nrps.counter });
 * @spec LTI-008
 */
export function createNrpsServices(deps: NrpsServiceDeps): NrpsServices {
  const store = new NrpsLearnerCountStore(deps.redis);
  const counter = new NrpsLearnerCounter({
    store,
    logger: deps.logger,
    maxPages: deps.maxPages,
    forgetToken: forgetNrpsToken(deps.db),
  });
  return { counter, counts: { read: (contextKey) => store.read(contextKey) } };
}
