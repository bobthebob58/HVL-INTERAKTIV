/**
 * createH5pRouter — every H5P route of the server, in the order that keeps the public files public and all
 * else behind authentication: the app origin's, and the files origin's for the player's files.
 *
 * Why: one function shows the whole H5P surface of the app origin (D-035): public client and library files first,
 *      then the editor's files behind a signed grant (D-058, D-069), then the `authenticate` middleware S3 provides,
 *      then the editor, file, learner-state, content and player routes, and last the error handler that translates
 *      every failure and never leaks a message. The player's files are not here: the files origin serves them
 *      (./filesOriginRouter.ts, D-110 amendment of 2026-11-05).
 * Spec: H5P-004, H5P-006, H5P-007, SEC-004
 * Invariants:
 *   - Only `/core`, `/editor`, `/libraries`, `/boot`, `/theme` and the grant-checked `/editor-files` and `/uploads`
 *     answer without an actor; everything else needs `authenticate`.
 *   - `/files/…`, the player's file path, is 404 here whatever the grant: the app origin never serves a player's file.
 *   - The files host's router answers only requests for the host of `FILES_BASE_URL` (./filesOriginRouter.ts).
 *   - The error handler is the last middleware; no route sends its own error body.
 *   - A path under the router that matches no route gets the translated 404 answer, never Express's page.
 * Collaborators: ./routes/*, ./h5pErrorHandler.ts, ./h5pLocals.ts (Authenticate), ../h5p/createH5pRuntime.ts,
 *   ./filesOriginRouter.ts (the player's files), ../config/filesOrigin.ts, ../h5p/render/editorIntegration.ts
 *   (`EDITOR_FILES_PATH`), ../server/createApp.ts (mounts both).
 * Tests: apps/server/test/http/router.int.test.ts, apps/server/test/http/editorFiles.int.test.ts,
 *   apps/server/test/http/filesOrigin.int.test.ts
 */
import { Router, type RequestHandler } from 'express';
import { filesOriginOf, type FilesOriginSettings } from '../config/filesOrigin.js';
import { SIGNED_FILES_PATH } from '../h5p/HvlUrlGenerator.js';
import { EDITOR_FILES_PATH } from '../h5p/render/editorIntegration.js';
import { h5pErrorHandler } from './h5pErrorHandler.js';
import { filesOriginRouter, routeFilesHost } from './filesOriginRouter.js';
import { HttpError } from './HttpError.js';
import type { Authenticate } from './h5pLocals.js';
import type { H5pRouteDeps } from './h5pRouteDeps.js';
import { ajaxRoutes } from './routes/ajaxRoutes.js';
import { contentRoutes } from './routes/contentRoutes.js';
import { fileRoutes } from './routes/fileRoutes.js';
import { playerRoutes } from './routes/playerRoutes.js';
import { signedFileRoutes } from './routes/signedFileRoutes.js';
import { signedUploadRoutes } from './routes/signedUploadRoutes.js';
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
  // SECURITY: the player's grants open files on the files origin only (./filesOriginRouter.ts, SEC-004).
  router.use(SIGNED_FILES_PATH, () => {
    throw new HttpError(404, 'error.notFound');
  });
  // SECURITY: before `authenticate`, because `<img>` and `<video>` in a cookie-less iframe send no credential.
  // The grant in the path is the authorisation (D-058, D-069).
  // SPEC-DEVIATION: D-110 — the editor's files stay on the app origin: H5P's image editor draws them into a canvas
  // without `crossorigin`, which a cross-origin image would taint. Only editors get these grants (Edit check).
  router.use(signedFileRoutes({ editor: deps.editor, grants: deps.editorFileGrants }, EDITOR_FILES_PATH));
  router.use(signedUploadRoutes(deps));
  router.use(authenticate);
  router.use(ajaxRoutes(deps));
  router.use(fileRoutes(deps));
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
 * @param deps - The H5P runtime: its content storage, the player's grants and the logger.
 * @param settings - `PUBLIC_BASE_URL` (the one origin CORS allows) and, when set, `FILES_BASE_URL`.
 * @returns Middleware to mount before every route that reads a credential (../server/createApp.ts).
 */
export function createFilesHostRouter(
  deps: Pick<H5pRouteDeps, 'editor' | 'fileGrants' | 'logger'>,
  settings: FilesOriginSettings,
): RequestHandler {
  const router = filesOriginRouter({ ...deps, appOrigin: settings.PUBLIC_BASE_URL });
  return routeFilesHost(filesOriginOf(settings), router);
}
