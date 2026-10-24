/**
 * staticRoutes — the public H5P files: core and editor client files, installed library files, the page boot
 * scripts and HVL's H5P theme.
 *
 * Why: the player and editor load these through <script> and <link> tags (also inside cookie-less LMS iframes
 *      in S3), so they cannot require a signed-in person. They are the same for everyone and contain no user data.
 *      The fetched core folder also holds PHP sources and documents that must never be served. The theme
 *      (UD-011) lives in workspace packages, so it is served by exact name from an allowlist, never by path.
 * Spec: H5P-004, SEC-004, UD-011
 * Invariants:
 *   - Only asset extensions are served (scripts, styles, fonts, images, JSON); everything else is 404.
 *   - `/boot/<name>` and `/theme/<name>` serve only the names in their allowlists; any other name is 404.
 *   - Every answer has `nosniff`; SVG library files also get the sandbox CSP.
 *   - Files are long-cached: URLs carry a version (Lumi's cache buster) and libraries are versioned folders. A
 *     theme file is long-cached only when the request names its current content version; otherwise it is
 *     revalidated, so an old or bare URL never pins old theme code in a browser.
 * Collaborators: ../createH5pRouter.ts, Lumi's H5PAjaxEndpoint.getLibraryFile, ../../h5p/h5pAssets.ts (theme files).
 * Tests: apps/server/test/http/router.int.test.ts, apps/server/test/http/themeRoutes.int.test.ts
 */
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { HttpError } from '../HttpError.js';
import { HVL_THEME_FILES, THEME_PATH, type ThemeFile } from '../../h5p/h5pAssets.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { pathParam, wildcardParam } from '../routeParams.js';

/** Extensions the core, editor and library folders may serve. */
export const STATIC_ASSET_EXTENSIONS: ReadonlySet<string> = new Set([
  '.js',
  '.css',
  '.json',
  '.png',
  '.gif',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
]);

const SANDBOX_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
const CLIENT_DIR = new URL('../../h5p/render/client/', import.meta.url);
/** The page boot files under `/boot/` (../../h5p/render/client), by name; nothing else is served there. */
const BOOT_SCRIPTS: ReadonlyMap<string, string> = new Map(
  ['h5pIntegration.js', 'editorFieldReveal.js', 'editorFields.js', 'editorPage.js'].map((name) => [
    name,
    fileURLToPath(new URL(name, CLIENT_DIR)),
  ]),
);
const YEAR_SECONDS = 365 * 24 * 60 * 60;
/** HVL's theme files under `/theme/`, by served name; nothing else is served there. */
const THEME_FILES: ReadonlyMap<string, ThemeFile> = new Map(HVL_THEME_FILES.map((file) => [file.name, file]));

const assetsOnly = (req: Request, _res: Response, next: NextFunction): void => {
  if (!STATIC_ASSET_EXTENSIONS.has(extname(req.path).toLowerCase()))
    throw new HttpError(404, 'error.notFound');
  next();
};

const staticFolder = (root: string) =>
  express.static(root, {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    fallthrough: false,
    maxAge: YEAR_SECONDS * 1000,
    setHeaders: (res, path) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (extname(path).toLowerCase() === '.svg') res.setHeader('Content-Security-Policy', SANDBOX_CSP);
    },
  });

/**
 * Builds the public routes.
 * @param deps - Core and editor folders and the AJAX endpoint.
 * @returns A router for `/boot`, `/theme`, `/core`, `/editor` and `/libraries`.
 */
export function staticRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
  router.get('/boot/:file', (req, res) => {
    const file = BOOT_SCRIPTS.get(pathParam(req, 'file'));
    if (!file) throw new HttpError(404, 'error.notFound');
    // WHY: the pages' boot code, served as files so the pages need no inline script (D-070).
    res.set({ 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.type('text/javascript').sendFile(file);
  });
  router.get(`${THEME_PATH}/:file`, (req, res) => {
    const file = THEME_FILES.get(pathParam(req, 'file'));
    if (!file) throw new HttpError(404, 'error.notFound');
    const current = req.query.version === file.version;
    res.set({
      'Cache-Control': current ? `public, max-age=${YEAR_SECONDS}, immutable` : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.type(extname(file.name) === '.js' ? 'text/javascript' : 'text/css').sendFile(file.path);
  });
  router.use('/core', assetsOnly, staticFolder(deps.corePath));
  router.use('/editor', assetsOnly, staticFolder(deps.editorPath));
  router.get('/libraries/:uberName/*file', assetsOnly, async (req, res) => {
    const file = wildcardParam(req, 'file');
    const { stream, stats, mimetype } = await deps.ajax.getLibraryFile(pathParam(req, 'uberName'), file);
    res.set({
      'Content-Type': mimetype,
      'Content-Length': String(stats.size),
      'Cache-Control': `public, max-age=${YEAR_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
    });
    if (extname(file).toLowerCase() === '.svg') res.set('Content-Security-Policy', SANDBOX_CSP);
    await pipeline(stream, res);
  });
  return router;
}
