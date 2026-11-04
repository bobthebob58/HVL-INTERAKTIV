/**
 * gradeBridgeApi — builds the services behind the grade bridge's `/api` routes: the xAPI ingestion of
 * `POST /api/h5p/xapi` and the retry limit of the grade-sync status and retry routes.
 *
 * Why: the contract's registry lists these routes (`GRADE_BRIDGE_ROUTES`, DOC-012), so every `/api` router, the app's
 *      and the test beds', mounts them the same way; one builder keeps them alike (LTI-011, LTI-012).
 * Spec: LTI-011, LTI-012, DOC-012
 * Invariants:
 *   - The ingestion's clock is the system clock: a batch's receive time is the server's (D-115).
 *   - The listener of stored rows is given by the caller (main.ts passes the grade enqueuer, D-104); without one,
 *     rows are stored and nothing is queued.
 *   - Nothing here owns a client: the server closes the database and Redis.
 * Collaborators: ../xapi/XapiIngest.ts, ../xapi/XapiStatementStore.ts, ../xapi/XapiRateLimit.ts,
 *   ../grades/status/GradeSyncRetryRateLimit.ts, ../http/api/apiRouter.ts, ./createApp.ts.
 * Tests: apps/server/test/http/api/apiDocs.int.test.ts, apps/server/test/xapi/xapiRouteAuth.int.test.ts
 */
import type { Logger } from 'pino';
import { GradeSyncRetryRateLimit } from '../grades/status/GradeSyncRetryRateLimit.js';
import type { ContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import type { ApiRouterDeps } from '../http/api/apiRouter.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import { XapiIngest, type XapiStoredListener } from '../xapi/XapiIngest.js';
import { XapiRateLimit } from '../xapi/XapiRateLimit.js';
import { XapiStatementStore } from '../xapi/XapiStatementStore.js';

/** What the grade bridge's routes are built from. */
export interface GradeBridgeApiDeps {
  readonly access: ContentAccessRepository;
  readonly db: Database;
  readonly redis: Redis;
  readonly logger: Logger;
  /** Called with a learner's new rows after they are stored; the grade enqueuer in main.ts (LTI-012). */
  readonly onXapiStored?: XapiStoredListener | undefined;
}

/**
 * Builds the grade bridge's `/api` services.
 * @param deps - The activity facts, the database, Redis, a logger and the listener of stored rows.
 * @returns `xapi` and `gradeSync` for `apiRouter`.
 * @example
 * apiRouter({ publishing, access, studio, ...gradeBridgeApi({ access, db, redis, logger }), serveDocs: false });
 * @spec LTI-011
 */
export function gradeBridgeApi(deps: GradeBridgeApiDeps): Pick<ApiRouterDeps, 'xapi' | 'gradeSync'> {
  const { access, db, redis, logger } = deps;
  const xapi = new XapiIngest({
    access,
    db,
    statements: new XapiStatementStore(db),
    rateLimit: new XapiRateLimit(redis),
    clock: () => new Date(),
    logger,
    ...(deps.onXapiStored ? { onStored: deps.onXapiStored } : {}),
  });
  return { xapi, gradeSync: { retryLimit: new GradeSyncRetryRateLimit(redis) } };
}
