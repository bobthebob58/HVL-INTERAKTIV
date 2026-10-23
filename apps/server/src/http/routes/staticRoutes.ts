/**
 * staticRoutes — the public H5P files: core and editor client files and installed library files.
 *
 * Why: the player and editor load these through <script> and <link> tags (also inside cookie-less LMS iframes
 *      in S3), so they cannot require a signed-in person. They are the same for everyone and contain no user data.
 *      The fetched core folder also holds PHP sources and documents that must never be served.
 * Spec: H5P-004, SEC-004
 * Invariants:
 *   - Only asset extensions are served (scripts, styles, fonts, images, JSON); everything else is 404.
 *   - Every answer has `nosniff`; SVG library files also get the sandbox CSP.
 *   - Files are long-cached: URLs carry a version (Lumi's cache buster) and libraries are versioned folders.
 * Collaborators: ../createH5pRouter.ts, Lumi's H5PAjaxEndpoint.getLibraryFile.
 * Tests: apps/server/test/http/router.int.test.ts
 */
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { HttpError } from '../HttpError.js';
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
const YEAR_SECONDS = 365 * 24 * 60 * 60;

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
 * @returns A router for `/core`, `/editor` and `/libraries`.
 */
export function staticRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
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
