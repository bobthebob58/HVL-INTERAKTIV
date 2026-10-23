/**
 * pageAssetRoutes — serves the stylesheet of the server-rendered pages at `/static/pages/`.
 *
 * Why: the friendly pages and the Deep Linking picker stay in Express (D-067) but use the token CSS; their own
 *      stylesheet is a static file, so their policies need no inline style (`style-src 'self'`, D-048).
 * Spec: UD-001, LTI-003
 * Invariants:
 *   - Only files in ./assets are served, never a directory listing or a dotfile; `nosniff`, revalidated each time.
 * Collaborators: ./htmlPage.ts (links the file), ./assets/serverPages.css, ../../server/createApp.ts.
 * Tests: apps/server/test/http/pages/pageAssets.int.test.ts
 */
import { fileURLToPath } from 'node:url';
import express, { Router } from 'express';

/** Where the server pages' stylesheet is served. */
export const SERVER_PAGES_STYLESHEET = '/static/pages/serverPages.css';

const ASSETS_DIR = fileURLToPath(new URL('./assets/', import.meta.url));

/**
 * Builds the route.
 * @returns A router to mount at `/`.
 */
export function pageAssetRoutes(): Router {
  const router = Router();
  router.use(
    '/static/pages',
    express.static(ASSETS_DIR, {
      dotfiles: 'deny',
      index: false,
      fallthrough: false,
      maxAge: 0,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
  return router;
}
