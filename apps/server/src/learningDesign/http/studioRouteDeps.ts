/**
 * studioRouteDeps — what every area router of the læringsdesign studio is built from: the database, the activity
 * facts, the clock and the studio's services.
 *
 * Why: five area routers (guide and catalogue, patterns, learning design, collaboration, mappe) are written in
 *      parallel (S5 workstreams W1–W4 and W6). One shared input type means a workstream that adds a service to
 *      `StudioServices` (../../server/studioServices.ts) reaches it in its routes without changing the studio router.
 * Spec: DOC-012, PED-001
 * Invariants:
 *   - `db` and `clock` are the publish flow's, and `access` is createApp's one instance, so a studio route sees the
 *     same activities, times and permissions as the S4 routes and the H5P router.
 *   - Every area router gets the same object; an area reads only the fields it needs.
 * Collaborators: ../../http/api/studioRouter.ts (passes it), ../../http/api/apiRouter.ts (builds it),
 *   ../../server/studioServices.ts, ./studioContentRoutes.ts, ./patternRoutes.ts, ./learningDesignRoutes.ts,
 *   ./collaborationRoutes.ts, ./mappeRoutes.ts.
 * Tests: apps/server/test/http/api/studioRouter.test.ts
 */
import type { Clock } from '../../content/publishingDeps.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import type { Database } from '../../infra/prismaClient.js';
import type { StudioServices } from '../../server/studioServices.js';

/** The inputs of every studio area router. */
export interface StudioRouteDeps {
  /** The database, for routes that read or write rows directly, as the S4 `/api` routes do. */
  readonly db: Database;
  /** The activity facts the permission rules (`decideContent`) read. */
  readonly access: ContentAccessRepository;
  /** The current moment; the publish flow's clock, so tests can move it. */
  readonly clock: Clock;
  /** The studio's services, built once per app. */
  readonly studio: StudioServices;
}
