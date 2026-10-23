/**
 * apiRouter — every route under `/api`, assembled in one place: me and notices, the content list, the publish flow,
 * sharing and (outside production) the OpenAPI document.
 *
 * Why: DOC-012 and D-077 list every `/api` route in the contract's registry; building the whole surface here lets a
 *      test walk exactly the routes Express mounts and compare them with the registry and the document.
 * Spec: DOC-012, PROD-003, PROD-011, PROD-006
 * Auth: the authentication middleware runs before this router (../../server/createApp.ts); each route module states
 *   its own mode. `/docs` needs nobody signed in.
 * Errors: each route module lists its own; a path that matches no route is answered by createApp's 404.
 * Invariants:
 *   - Sub-routers are mounted at the router's root, so their route paths are the paths below `/api`.
 *   - Every answer is `Cache-Control: no-store`: it is about one signed-in person.
 *   - `/docs` exists only when `serveDocs` is true (NODE_ENV is not production).
 * Collaborators: ./meRoutes.ts, ./contentListRoutes.ts, ./publishRoutes.ts, ./contentSharingRoutes.ts,
 *   ./apiDocsRoutes.ts, ../../content/ContentPublisher.ts, ../../server/createApp.ts.
 * Tests: apps/server/test/http/api/apiDocs.int.test.ts
 */
import { Router } from 'express';
import { ContentPublisher } from '../../content/ContentPublisher.js';
import type { PublishingDeps } from '../../content/publishingDeps.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { apiDocsRoutes } from './apiDocsRoutes.js';
import { contentListRoutes } from './contentListRoutes.js';
import { contentSharingRoutes } from './contentSharingRoutes.js';
import { meRoutes } from './meRoutes.js';
import { publishRoutes } from './publishRoutes.js';

/** What the `/api` routes are built from. */
export interface ApiRouterDeps {
  /** Database, validator and clock of the publish flow; the database also serves the other routes. */
  readonly publishing: PublishingDeps;
  /** The activity facts the permission rules read. */
  readonly access: ContentAccessRepository;
  /** Mount `/docs` (D-077: development and test only). */
  readonly serveDocs: boolean;
}

/**
 * Builds the `/api` router.
 * @param deps - Publish-flow dependencies, activity facts and whether to serve the document.
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
  router.use(publishRoutes({ access: deps.access, publisher: new ContentPublisher(deps.publishing) }));
  router.use(contentSharingRoutes({ db, access: deps.access }));
  if (deps.serveDocs) router.use(apiDocsRoutes());
  return router;
}
