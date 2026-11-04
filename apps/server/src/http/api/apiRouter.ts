/**
 * apiRouter — every route under `/api`, assembled in one place: me and notices, the content list, the publish flow,
 * sharing, the læringsdesign studio's areas, insight, the player bridge's xAPI batches and (outside production) the
 * OpenAPI document.
 *
 * Why: DOC-012 and D-077 list every `/api` route in the contract's registry; building the whole surface here lets a
 *      test walk exactly the routes Express mounts and compare them with the registry and the document.
 * Spec: DOC-012, PROD-003, PROD-011, PROD-006, PED-001, LTI-011, LTI-012, INS-007
 * Auth: the authentication middleware runs before this router (../../server/createApp.ts); each route module states
 *   its own mode. `/docs` needs nobody signed in.
 * Errors: each route module lists its own; a path that matches no route is answered by createApp's 404.
 * Invariants:
 *   - Sub-routers are mounted at the router's root, so their route paths are the paths below `/api`.
 *   - Every answer is `Cache-Control: no-store`: it is about one signed-in person.
 *   - `/docs` exists only when `serveDocs` is true (NODE_ENV is not production).
 *   - The studio's routes (./studioRouter.ts) come after the S4 routes and before `/docs`, and share the publish flow's
 *     database and clock and the one activity-facts instance.
 *   - The grade bridge's routes, `POST /h5p/xapi` (../../xapi/xapiRoutes.ts) and the grade-sync status and retry
 *     (../../grades/status/gradeSyncRoutes.ts), are always mounted, as the contract's registry lists them
 *     (`GRADE_BRIDGE_ROUTES`); ../../server/gradeBridgeApi.ts builds their services for the app and the test beds.
 *   - The insight routes (../../insight/http/insightRoutes.ts) are always mounted, as the registry lists them
 *     (`INSIGHT_ROUTES`), and share the publish flow's findings (INS-010); ../../insight/http/insightApi.ts builds
 *     their services. Until a caller passes `insight`, they fail with 500 after the sign-in and access checks.
 * Collaborators: ./meRoutes.ts, ./contentListRoutes.ts, ./publishRoutes.ts, ./contentSharingRoutes.ts,
 *   ./studioRouter.ts, ../../xapi/xapiRoutes.ts, ../../grades/status/gradeSyncRoutes.ts,
 *   ../../server/gradeBridgeApi.ts, ../../insight/http/insightRoutes.ts, ./apiDocsRoutes.ts,
 *   ../../content/ContentPublisher.ts, ../../server/createApp.ts, ../../server/studioServices.ts.
 * Tests: apps/server/test/http/api/apiDocs.int.test.ts, apps/server/test/http/api/studioPublicRoute.int.test.ts
 */
import { Router } from 'express';
import { ContentPublisher } from '../../content/ContentPublisher.js';
import type { PublishingDeps } from '../../content/publishingDeps.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { insightRoutes, type InsightServices } from '../../insight/http/insightRoutes.js';
import type { StudioServices } from '../../server/studioServices.js';
import { gradeSyncRoutes, type GradeSyncRouteDeps } from '../../grades/status/gradeSyncRoutes.js';
import type { XapiIngest } from '../../xapi/XapiIngest.js';
import { xapiRoutes } from '../../xapi/xapiRoutes.js';
import { apiDocsRoutes } from './apiDocsRoutes.js';
import { contentListRoutes } from './contentListRoutes.js';
import { contentSharingRoutes } from './contentSharingRoutes.js';
import { meRoutes } from './meRoutes.js';
import { publishRoutes } from './publishRoutes.js';
import { studioRouter } from './studioRouter.js';

/** What the `/api` routes are built from. */
export interface ApiRouterDeps {
  /** Database, validator and clock of the publish flow; the database also serves the other routes. */
  readonly publishing: PublishingDeps;
  /** The activity facts the permission rules read. */
  readonly access: ContentAccessRepository;
  /** The læringsdesign studio's services (../../server/studioServices.ts). */
  readonly studio: StudioServices;
  /** Mount `/docs` (D-077: development and test only). */
  readonly serveDocs: boolean;
  /** The xAPI ingestion behind `POST /h5p/xapi` (LTI-011; ../../server/gradeBridgeApi.ts builds it). */
  readonly xapi: Pick<XapiIngest, 'ingest'>;
  /** The grade-sync status and retry routes' retry limit (LTI-012). */
  readonly gradeSync: Pick<GradeSyncRouteDeps, 'retryLimit' | 'clock'>;
  /** The insight core and its request limit (../../insight/http/insightApi.ts); without them insight fails (500). */
  readonly insight?: InsightServices | undefined;
}

/**
 * Builds the `/api` router.
 * @param deps - Publish-flow dependencies, activity facts, the studio's services and whether to serve the document.
 * @returns A router to mount at `/api`, after the authentication middleware.
 */
export function apiRouter(deps: ApiRouterDeps): Router {
  const { db, clock } = deps.publishing;
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(meRoutes({ db, clock }));
  router.use(contentListRoutes({ db, access: deps.access }));
  const publisher = new ContentPublisher(deps.publishing);
  router.use(publishRoutes({ access: deps.access, publisher }));
  router.use(contentSharingRoutes({ db, access: deps.access }));
  router.use(studioRouter({ db, clock, access: deps.access, studio: deps.studio }));
  router.use(xapiRoutes({ ingest: deps.xapi }));
  router.use(gradeSyncRoutes({ db, access: deps.access, ...deps.gradeSync }));
  router.use(
    insightRoutes({
      db,
      access: deps.access,
      findings: (contentId, locale) => publisher.findings(contentId, locale),
      services: deps.insight,
    }),
  );
  if (deps.serveDocs) router.use(apiDocsRoutes());
  return router;
}
