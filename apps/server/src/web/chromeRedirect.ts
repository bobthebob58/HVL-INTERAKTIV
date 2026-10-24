/**
 * chromeRedirect — sends a top-level navigation to an H5P player or editor page on to the web-app page that frames
 * it.
 *
 * Why: the H5P pages carry no header, help link or privacy link; the web app's chrome pages do. D-067 lets H5P pages
 *      refuse a top-level navigation, so the privacy link (`DATA-006`) and **Hjelp** (`UD-013`) are always on screen,
 *      also when someone opens a frame in a new tab or follows an old link.
 * Spec: DATA-006, UD-013, D-067
 * Invariants:
 *   - Only a browser's own top-level navigation is redirected (`Sec-Fetch-Dest: document` with
 *     `Sec-Fetch-Mode: navigate`); frames, scripts, fetches and clients without fetch metadata get the page as before.
 *   - An LTI page keeps its ltik on the way to `/app/play` (which takes it from the query, D-069) and nothing else of
 *     the query; the answer is never cached.
 *   - Mounted only when the web app runs; without it, the H5P pages are the only pages there are.
 * Collaborators: ../server/createApp.ts (mounts it), ../lti/play/appLaunchRoutes.ts (`/app/play`),
 *   ../lti/http/ltiPageHeaders.ts (`isFramedByAppPlay`), apps/web's `/aktivitet/[id]` and `/aktivitet/ny` pages.
 * Tests: apps/server/test/web/chromeRedirect.test.ts
 */
import type { Request, RequestHandler } from 'express';
import { isFramedByAppPlay } from '../lti/http/ltiPageHeaders.js';
import { APP_PLAY_PATH } from '../lti/play/appLaunchRoutes.js';

/** The chrome page of an activity in the portal (apps/web `/aktivitet/[id]`). */
export const activityChromePath = (contentId: string): string =>
  `/aktivitet/${encodeURIComponent(contentId)}`;

/** The chrome page of a new activity (apps/web `/aktivitet/ny`). */
export const NEW_ACTIVITY_CHROME_PATH = '/aktivitet/ny';

// WHY: content IDs are UUIDs; any other segment is left to the H5P route, which answers 404. Paths match as
// Express routes them (no strict routing, no case sensitivity), so no spelling of a page escapes its chrome.
const PORTAL_PAGE = /^\/h5p\/(?:play|edit)\/([\w-]+)\/?$/i;
const NEW_PAGE = /^\/h5p\/new\/?$/i;

/**
 * Tells whether a request is the browser's own top-level navigation.
 * @param req - The request.
 * @returns True for a navigation into a window or tab, false for frames, subresources and plain HTTP clients.
 */
export const isTopLevelNavigation = (req: Request): boolean =>
  (req.method === 'GET' || req.method === 'HEAD') &&
  req.get('sec-fetch-dest') === 'document' &&
  req.get('sec-fetch-mode') === 'navigate';

/**
 * The chrome page a top-level request for an H5P page belongs on.
 * @param req - The request.
 * @returns The path (with the ltik for LTI pages), or undefined when the path is not an H5P page.
 */
export function chromePathOf(req: Request): string | undefined {
  const portal = PORTAL_PAGE.exec(req.path);
  if (portal?.[1] !== undefined) return activityChromePath(portal[1]);
  if (NEW_PAGE.test(req.path)) return NEW_ACTIVITY_CHROME_PATH;
  if (!isFramedByAppPlay(req.path)) return undefined;
  const { ltik } = req.query;
  return typeof ltik === 'string'
    ? `${APP_PLAY_PATH}?${new URLSearchParams({ ltik }).toString()}`
    : APP_PLAY_PATH;
}

/**
 * Builds the redirect middleware.
 * @returns Middleware that answers a top-level navigation to an H5P page with 303 to its chrome page.
 */
export function chromeRedirect(): RequestHandler {
  return (req, res, next) => {
    const target = isTopLevelNavigation(req) ? chromePathOf(req) : undefined;
    if (target === undefined) {
      next();
      return;
    }
    // SECURITY: the Location may hold an ltik; never cache it, never send it on as a Referer.
    res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer').redirect(303, target);
  };
}
