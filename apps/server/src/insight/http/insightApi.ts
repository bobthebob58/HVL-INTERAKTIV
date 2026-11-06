/**
 * insightApi — builds the services behind the insight routes: the insight core (with the content store, the NRPS
 * learner counts and *k*) and the per-person request limit.
 *
 * Why: the contract's registry lists the insight routes (`INSIGHT_ROUTES`, DOC-012), so every `/api` router, the app's
 *      and the test beds', mounts them the same way; one builder keeps them alike, as ../../server/gradeBridgeApi.ts
 *      does for the grade bridge.
 * Spec: INS-001, INS-006, INS-007, LTI-008, DOC-012
 * Invariants:
 *   - *k* comes from `MIN_GROUP_SIZE` (at least 3, default 5) through `minimumGroupSize`, as the mappe's does (D-095).
 *   - The completion rate's course base is the NRPS count stored for the context (LTI-008, D-103).
 *   - The content store is the H5P editor's (`IContentStorage`); insight reads only `getMetadata` and
 *     `getParameters` from it.
 *   - Building contacts nothing, and nothing here owns a client: the server closes the database and Redis.
 * Collaborators: ../InsightService.ts, ./InsightRateLimit.ts, ../../lti/nrps/NrpsLearnerCountStore.ts,
 *   ../../privacy/minimumGroupSize.ts, ./insightRoutes.ts, ../../http/api/apiRouter.ts,
 *   ../../server/createApp.ts (the app's wiring).
 * Tests: apps/server/test/insight/http/insightApi.int.test.ts, apps/server/test/insight/http/insightRoutes.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { Redis } from '../../infra/redisClient.js';
import { NrpsLearnerCountStore } from '../../lti/nrps/NrpsLearnerCountStore.js';
import { minimumGroupSize } from '../../privacy/minimumGroupSize.js';
import { InsightService, type InsightContentSource } from '../InsightService.js';
import { InsightRateLimit } from './InsightRateLimit.js';
import type { InsightServices } from './insightRoutes.js';

/** What the insight services are built from. */
export interface InsightApiDeps {
  readonly db: Database;
  readonly redis: Redis;
  /** The H5P content store (`HvlH5PEditor.contentStorage`). */
  readonly content: InsightContentSource;
  /** `MIN_GROUP_SIZE` (INS-006). */
  readonly minGroupSize: number;
}

/**
 * Builds the insight services.
 * @param deps - The database, Redis, the content store and *k*.
 * @returns `insight` for `apiRouter`.
 * @example
 * apiRouter({ ...rest, insight: insightApi({ db, redis, content: h5p.editor.contentStorage, minGroupSize }) });
 * @spec INS-007
 */
export function insightApi(deps: InsightApiDeps): InsightServices {
  return {
    insight: new InsightService({
      db: deps.db,
      content: deps.content,
      learnerCounts: new NrpsLearnerCountStore(deps.redis),
      groupSize: minimumGroupSize(deps.minGroupSize),
    }),
    limit: new InsightRateLimit(deps.redis),
  };
}
