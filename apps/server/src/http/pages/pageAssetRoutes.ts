/**
 * pageAssetRoutes — serves the stylesheet of the server-rendered pages at `/static/pages/`.
 *
 * Why: the friendly pages, the Deep Linking picker and the editor's outer page stay in Express (D-067) but use the
 *      token CSS; their own stylesheets are static files, so their policies need no inline style (`style-src 'self'`,
 *      D-048). The editor page's save choice dialog styles its `::backdrop` here too (PROD-013, D-093).
 * Spec: UD-001, LTI-003, PROD-013
 * Invariants:
 *   - Only files in ./assets are served, never a directory listing or a dotfile; `nosniff`, revalidated each time.
 * Collaborators: ./htmlPage.ts and ../../h5p/render/editorPage.ts (link the files), ./assets/serverPages.css,
 *   ./assets/serverChrome.css, ./assets/editorSaveChoice.css, ../../server/createApp.ts.
 * Tests: apps/server/test/http/pages/pageAssets.int.test.ts
 */
import { fileURLToPath } from 'node:url';
import express, { Router } from 'express';

/** Where the server pages' stylesheet is served. */
export const SERVER_PAGES_STYLESHEET = '/static/pages/serverPages.css';

/** Where the stylesheet of their skip link and Hjelp header is served (pages with the header only). */
export const SERVER_CHROME_STYLESHEET = '/static/pages/serverChrome.css';

/** Where the editor page's save choice dialog stylesheet is served (PROD-013, the editor page only). */
export const EDITOR_SAVE_CHOICE_STYLESHEET = '/static/pages/editorSaveChoice.css';

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
