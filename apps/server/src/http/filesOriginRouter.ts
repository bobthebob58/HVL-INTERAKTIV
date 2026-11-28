/**
 * filesOriginRouter — everything the files origin answers (the player's files, the editor's files and fresh uploads,
 * each behind its own grant; a CORS preflight for them; 404 for anything else), and the middleware that sends the
 * files host's requests there and nowhere else.
 *
 * Why: `SEC-004` asks that content files come from a separate origin in production, so a script in a crafted file
 *      reaches neither the app's origin nor its cookies or the ltik (D-012, D-045, CVE-2025-7062). One process serves
 *      both origins and tells them apart by host; a files-host request meets this router before the portal session,
 *      LTI, Feide, `/api`, `/h5p` and the web app, so nothing there reads or sets a credential (D-110 amendment of
 *      2026-11-05). Since D-153 the editor's files and an author's fresh uploads are served here too, and nowhere else.
 * Spec: SEC-004, H5P-007, H5P-004
 * Invariants:
 *   - A request for the files host (`req.hostname`, case-insensitive) is answered here and never falls through to
 *     another route of the app; a request for any other host never reaches this router.
 *   - Only `GET`/`HEAD` on three paths serve a file, each to its own kind of grant: `/h5p/files/<grant>/<contentId>/…`
 *     (the player's, purpose `content-file-url`), `/h5p/editor-files/<grant>/<contentId>/…` (the editor's,
 *     `editor-file-url`; both ./routes/signedFileRoutes.ts) and `/h5p/uploads/<grant>/<owner>/…` (fresh uploads,
 *     `temporary-file-url`; ./routes/signedUploadRoutes.ts). A grant of one kind opens nothing on another path.
 *     `OPTIONS` on those paths answers a CORS preflight; everything else is 404.
 *   - Every answer, refusals included, carries the sandbox policy (`USER_FILE_CSP`) and allows the app origin by CORS
 *     (`Access-Control-Allow-Origin`, never `-Credentials`), so H5P's `crossorigin="anonymous"` loads work, captions
 *     (`<track>`) included; `nosniff` and `no-referrer` come from the app's base headers.
 *   - Nothing here reads a cookie, a session, an ltik or an `Authorization` header, and nothing sets a cookie.
 * Collaborators: ./routes/signedFileRoutes.ts, ./routes/signedUploadRoutes.ts, ../security/ContentFileHeaders.ts
 *   (`USER_FILE_CSP`), ./h5pErrorHandler.ts, ./createH5pRouter.ts (`createFilesHostRouter` builds both from the
 *   configuration; answers 404 on `GRANTED_FILE_PATHS`), ../server/createApp.ts (mounts it after the request log and
 *   the base headers), ../h5p/HvlUrlGenerator.ts and ../h5p/render/editorIntegration.ts (the URLs it serves).
 * Tests: apps/server/test/http/filesOrigin.int.test.ts, apps/server/test/http/editorFiles.int.test.ts,
 *   apps/server/test/http/signedUploads.int.test.ts, apps/server/e2e/filesOrigin.e2e.test.ts,
 *   apps/server/e2e/editorImageTool.e2e.test.ts
 */
import { Router, type RequestHandler } from 'express';
import type { Logger } from 'pino';
import { SIGNED_FILES_PATH } from '../h5p/HvlUrlGenerator.js';
import { EDITOR_FILES_PATH, SIGNED_UPLOADS_PATH } from '../h5p/render/editorIntegration.js';
import { USER_FILE_CSP } from '../security/ContentFileHeaders.js';
import { h5pErrorHandler } from './h5pErrorHandler.js';
import type { H5pRouteDeps } from './h5pRouteDeps.js';
import { HttpError } from './HttpError.js';
import { signedFileRoutes } from './routes/signedFileRoutes.js';
import { signedUploadRoutes } from './routes/signedUploadRoutes.js';

/** The paths, under the H5P base URL, that serve a file to a grant holder; the app origin answers 404 on each. */
export const GRANTED_FILE_PATHS = [SIGNED_FILES_PATH, EDITOR_FILES_PATH, SIGNED_UPLOADS_PATH] as const;

/** The storage and the three kinds of grant of the files a grant opens. */
export type GrantedFileDeps = Pick<
  H5pRouteDeps,
  'editor' | 'fileGrants' | 'editorFileGrants' | 'uploadGrants'
>;

/** How long a browser may keep a preflight answer, in seconds. */
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/** What the files origin needs. */
export interface FilesOriginDeps extends GrantedFileDeps {
  /** The app's origin (`PUBLIC_BASE_URL`), the one origin allowed to read files by CORS. */
  readonly appOrigin: string;
  /** For the error handler, which logs failures without the request's grant (../logging/redactText.ts). */
  readonly logger: Logger;
}

/**
 * The routes that serve a file to whoever holds a grant: the player's files, the editor's files and an author's fresh
 * uploads, each with its own kind of grant.
 * @param deps - The editor (content and temporary storage) and the three grant verifiers.
 * @returns A router to mount at the H5P base URL: on the files origin, or on the one server of a test bed.
 */
export function grantedFileRoutes(deps: GrantedFileDeps): Router {
  const router = Router();
  router.use(signedFileRoutes({ editor: deps.editor, grants: deps.fileGrants }, SIGNED_FILES_PATH));
  // SECURITY: only editors get these two kinds of grant, after the Edit check (../h5p/render/editorIntegration.ts).
  router.use(signedFileRoutes({ editor: deps.editor, grants: deps.editorFileGrants }, EDITOR_FILES_PATH));
  router.use(signedUploadRoutes(deps));
  return router;
}

/**
 * Builds the router of the files origin.
 * @param deps - Content and temporary storage, the three kinds of grant, the app origin and the logger.
 * @returns A router that answers every request it gets, ending with the translated error handler.
 */
export function filesOriginRouter(deps: FilesOriginDeps): Router {
  const router = Router();
  // WHY: the same paths as the pages' URLs (`<files origin><H5P base URL>/files/…`, ../h5p/HvlUrlGenerator.ts).
  const mount = deps.editor.config.baseUrl;
  router.use((_req, res, next) => {
    // SECURITY: a refusal is a document of the files origin too; nothing it answers may run script (SEC-004).
    res.set('Content-Security-Policy', USER_FILE_CSP);
    // WHY: H5P loads content files with `crossorigin="anonymous"` (../h5p/render/playerPage.ts), and a browser
    // refuses a cross-origin caption track without CORS, and the export of a canvas that holds a picture loaded
    // without it (the editor's picture tool). No credentials: the files origin never sees a cookie.
    res.set('Access-Control-Allow-Origin', deps.appOrigin);
    next();
  });
  const preflighted = GRANTED_FILE_PATHS.map((path) => `${mount}${path}/*rest`);
  router.options(preflighted, (_req, res) => {
    res.set({
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_SECONDS),
    });
    res.status(204).end();
  });
  router.use(mount, grantedFileRoutes(deps));
  router.use(() => {
    throw new HttpError(404, 'error.notFound');
  });
  router.use(h5pErrorHandler(deps.logger));
  return router;
}

/**
 * Sends the requests for the files host to the files origin's router, and every other request on.
 * @param filesOrigin - The files origin (../config/filesOrigin.ts), e.g. `https://files.interaktiv.hvl.no`.
 * @param router - The files origin's router (`filesOriginRouter`).
 * @returns Express middleware; mount it before every route that reads a credential.
 */
export function routeFilesHost(filesOrigin: string, router: RequestHandler): RequestHandler {
  const filesHost = new URL(filesOrigin).hostname.toLowerCase();
  return (req, res, next) => {
    if ((req.hostname ?? '').toLowerCase() !== filesHost) {
      next();
      return;
    }
    // SECURITY: whatever happens inside, a files-host request never falls through to the app's own routes.
    void router(req, res, () => {
      if (!res.headersSent) res.status(404).end();
    });
  };
}
