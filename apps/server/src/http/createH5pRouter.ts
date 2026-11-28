/**
 * createH5pRouter — every H5P route of the server, in the order that keeps the public files public and all
 * else behind authentication: the app origin's, and the files origin's for every file an author uploaded.
 *
 * Why: one function shows the whole H5P surface of the app origin (D-035): public client and library files first,
 *      then the `authenticate` middleware S3 provides, then the editor, learner-state, content and player routes,
 *      and last the error handler that translates every failure and never leaks a message. No file an author
 *      uploaded is served here: the files origin serves the player's files, the editor's and fresh uploads, each
 *      behind a signed grant (./filesOriginRouter.ts, D-058, D-069, D-110 amendment of 2026-11-05, D-153), and
 *      the two routes that once served files to a session cookie (`/content/<id>/<file>`, `/temp-files/<file>`)
 *      are gone: no page of ours pointed H5P at them.
 * Spec: H5P-004, H5P-006, H5P-007, SEC-004
 * Invariants:
 *   - Only `/core`, `/editor`, `/libraries`, `/boot` and `/theme` answer without an actor; everything else needs
 *     `authenticate`.
 *   - `/files/…`, `/editor-files/…` and `/uploads/…`, the paths of the grant-checked files, are 404 here whatever the
 *     grant: the app origin never serves a file an author uploaded, neither to a grant nor to a signed-in person.
 *   - The files host's router answers only requests for the host of `FILES_BASE_URL` (./filesOriginRouter.ts).
 *   - The error handler is the last middleware; no route sends its own error body.
 *   - A path under the router that matches no route gets the translated 404 answer, never Express's page.
 * Collaborators: ./routes/*, ./h5pErrorHandler.ts, ./h5pLocals.ts (Authenticate), ../h5p/createH5pRuntime.ts,
 *   ./filesOriginRouter.ts (the grant-checked files, `GRANTED_FILE_PATHS`), ../config/filesOrigin.ts,
 *   ../server/createApp.ts (mounts both).
 * Tests: apps/server/test/http/router.int.test.ts, apps/server/test/http/editorFiles.int.test.ts,
 *   apps/server/test/http/filesOrigin.int.test.ts, apps/server/test/http/contentFiles.int.test.ts
 */
import { Router, type RequestHandler } from 'express';
import { filesOriginOf, type FilesOriginSettings } from '../config/filesOrigin.js';
import { h5pErrorHandler } from './h5pErrorHandler.js';
import {
  filesOriginRouter,
  GRANTED_FILE_PATHS,
  routeFilesHost,
  type GrantedFileDeps,
} from './filesOriginRouter.js';
import { HttpError } from './HttpError.js';
import { ownAnswerHeaders } from './securityHeaders.js';
import type { Authenticate } from './h5pLocals.js';
import type { H5pRouteDeps } from './h5pRouteDeps.js';
import { ajaxRoutes } from './routes/ajaxRoutes.js';
import { contentRoutes } from './routes/contentRoutes.js';
import { playerRoutes } from './routes/playerRoutes.js';
import { editorRoutes } from './routes/editorRoutes.js';
import { staticRoutes } from './routes/staticRoutes.js';
import { userDataRoutes } from './routes/userDataRoutes.js';

/**
 * Builds the H5P router (mounted at `/h5p` in S3).
 * @param deps - The H5P runtime the routes use.
 * @param authenticate - Middleware that sets `res.locals.h5pActor` for a signed-in person.
 * @returns The router.
 */
export function createH5pRouter(deps: H5pRouteDeps, authenticate: Authenticate): Router {
  const router = Router();
  router.use(staticRoutes(deps));
  // SECURITY: a grant opens a file on the files origin only (./filesOriginRouter.ts, SEC-004, D-153): the paths of
  // the player's files, the editor's files and fresh uploads are 404 here, whatever the grant and whoever asks.
  for (const path of GRANTED_FILE_PATHS) {
    router.use(path, () => {
      throw new HttpError(404, 'error.notFound');
    });
  }
  router.use(authenticate);
  // SECURITY: everything below answers a signed-in person: never cached, never embedded by another site (D-131).
  router.use(ownAnswerHeaders);
  router.use(ajaxRoutes(deps));
  router.use(userDataRoutes(deps));
  router.use(contentRoutes(deps));
  router.use(playerRoutes(deps));
  router.use(editorRoutes(deps));
  router.use(() => {
    throw new HttpError(404, 'error.notFound');
  });
  router.use(h5pErrorHandler(deps.logger));
  return router;
}

/**
 * Builds the files host's middleware: requests for the host of the files origin get its router, all others go on.
 * @param deps - The H5P runtime: its storages, the three kinds of file grant and the logger.
 * @param settings - `PUBLIC_BASE_URL` (the one origin CORS allows) and, when set, `FILES_BASE_URL`.
 * @returns Middleware to mount before every route that reads a credential (../server/createApp.ts).
 */
export function createFilesHostRouter(
  deps: GrantedFileDeps & Pick<H5pRouteDeps, 'logger'>,
  settings: FilesOriginSettings,
): RequestHandler {
  const router = filesOriginRouter({ ...deps, appOrigin: settings.PUBLIC_BASE_URL });
  return routeFilesHost(filesOriginOf(settings), router);
}
