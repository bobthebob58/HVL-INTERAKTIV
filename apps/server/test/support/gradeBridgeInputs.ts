/**
 * gradeBridgeInputs — the grade bridge's inputs to `createApp` for a test bed, built as main.ts builds them: the grade
 * enqueuer that hears the xAPI ingestion's stored rows and, when asked, the NRPS learner counter a launch starts.
 *
 * Why: a test bed must run the app as main.ts does (LTI-012), but the NRPS count reads the mock Canvas's roster in the
 *      background of every launch (LTI-008), which would add token requests and Redis keys to tests that count them;
 *      so only a bed that asks for it gets the counter.
 * Spec: LTI-012, LTI-008
 * Invariants:
 *   - The enqueuer is always given, with the bed's own encryption keys and logger, as in main.ts.
 *   - The counter reads at most 100 pages, `NRPS_MAX_PAGES`'s default.
 * Collaborators: ./appTestbed.ts, ../../src/server/main.ts, ../../src/grades/GradeJobEnqueuer.ts,
 *   ../../src/lti/nrps/nrpsServices.ts.
 * Tests: apps/server/test/lti/nrps/launchNrpsCount.int.test.ts, apps/server/e2e/xapiToCanvas.e2e.test.ts
 */
import type { Logger } from 'pino';
import type { Env } from '../../src/config/env.js';
import { GradeJobEnqueuer } from '../../src/grades/GradeJobEnqueuer.js';
import type { Database } from '../../src/infra/prismaClient.js';
import type { Redis } from '../../src/infra/redisClient.js';
import { createNrpsServices } from '../../src/lti/nrps/nrpsServices.js';
import { DataEncryption } from '../../src/security/keys/DataEncryption.js';
import type { AppInputs } from '../../src/server/createApp.js';

/** The clients the inputs are built from. */
export interface GradeBridgeClients {
  readonly env: Env;
  readonly db: Database;
  readonly redis: Redis;
  readonly logger: Logger;
}

/**
 * Builds the grade bridge's inputs.
 * @param clients - The bed's configuration, database, Redis and logger.
 * @param nrps - Also count each launched course's learners (LTI-008).
 * @returns `onXapiStored`, and `nrps` when asked for.
 */
export function gradeBridgeInputs(
  clients: GradeBridgeClients,
  nrps = false,
): Pick<AppInputs, 'onXapiStored' | 'nrps'> {
  const { env, db, redis, logger } = clients;
  const encryption = new DataEncryption(env.DATA_ENCRYPTION_KEYS);
  const { onStored } = new GradeJobEnqueuer({ db, encryption, logger });
  if (!nrps) return { onXapiStored: onStored };
  return { onXapiStored: onStored, nrps: createNrpsServices({ db, redis, logger, maxPages: 100 }).counter };
}
