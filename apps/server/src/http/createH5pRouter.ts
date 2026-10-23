/**
 * createH5pRouter — every H5P route of the server, in the order that keeps the public files public and all
 * else behind authentication.
 *
 * Why: one function shows the whole H5P surface (D-035): public client and library files first, then the
 *      content files behind a signed grant (D-058), then the `authenticate` middleware S3 provides, then the
 *      editor, file, learner-state, content and player routes, and last the error handler that translates every
 *      failure and never leaks a message.
 * Spec: H5P-004, H5P-006, H5P-007, SEC-004
 * Invariants:
 *   - Only `/core`, `/editor`, `/libraries`, `/boot` and the grant-checked `/files` and `/uploads` answer without
 *     an actor; everything else needs `authenticate`.
 *   - The error handler is the last middleware; no route sends its own error body.
 *   - A path under the router that matches no route gets the translated 404 answer, never Express's page.
 * Collaborators: ./routes/*, ./h5pErrorHandler.ts, ./h5pLocals.ts (Authenticate), ../h5p/createH5pRuntime.ts.
 * Tests: apps/server/test/http/router.int.test.ts, apps/server/test/http/signedFiles.int.test.ts
 */
import { Router } from 'express';
import { h5pErrorHandler } from './h5pErrorHandler.js';
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
  // SECURITY: before `authenticate`, because `<img>` and `<video>` in a cookie-less iframe send no credential.
  // The grant in the path is the authorisation (D-058).
  router.use(signedFileRoutes(deps));
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
