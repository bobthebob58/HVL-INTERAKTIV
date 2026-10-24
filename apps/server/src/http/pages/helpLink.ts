/**
 * helpLink — whether the pages Express renders itself show the **Hjelp** link, and whether it opens a new tab.
 *
 * Why: UD-013 wants a Hjelp link in the same place on every page. The web app's pages have it in their header; the
 *      friendly error pages and the Deep Linking picker stay server-rendered (D-067). Opened on their own (in the
 *      browser, or as the page of Canvas's iframe) they render the same header themselves (./htmlPage.ts). Inside
 *      our own chrome (`/app/play` frames `/lti/play` and `/lti/edit`, `/aktivitet` frames `/h5p/play` and
 *      `/h5p/edit`) the chrome's header already shows Hjelp, so a second one inside the frame would only repeat it.
 *      `/hjelp` is a web-app page, so the link is offered only when the web app runs; with `WEB_APP=off` it would
 *      lead to a 404.
 * Spec: UD-013, UD-007
 * Invariants:
 *   - `offerHelpLink()` is mounted only when the web app runs, before every route that renders a page; without it,
 *     `helpLinkFor` is always undefined and pages have no header.
 *   - A frame our own origin asked for (`Sec-Fetch-Dest: iframe` or `frame` with `Sec-Fetch-Site: same-origin`) gets
 *     no header; Canvas's iframe (cross-site, also after the launch's redirects), top-level pages and clients
 *     without fetch metadata get it.
 *   - Inside Canvas (`'canvas'`) the link opens a new tab and says so, so the launch in the frame is not lost
 *     (UD-007); a portal page's link replaces the whole window.
 * Collaborators: ./htmlPage.ts (renders the header), ./portalPages.ts, ../../lti/http/ltiErrorPages.ts,
 *   ../../lti/deepLinking/deepLinkRoutes.ts, ../../server/createApp.ts (mounts the middleware).
 * Tests: apps/server/test/http/pages/htmlPage.test.ts, apps/server/test/http/pages/portalPages.test.ts,
 *   apps/server/test/lti/http/ltiErrorPages.test.ts
 */
import type { Request, RequestHandler, Response } from 'express';

/** The web app's help page (apps/web `/hjelp`). */
export const HELP_PATH = '/hjelp';

/** How a page links to help. */
export interface HelpLink {
  /** Open `/hjelp` in a new tab (pages inside Canvas), else in the whole window. */
  readonly newTab: boolean;
}

const OFFERED = 'hvliHelpLinkOffered';
const FRAME_DESTINATIONS = new Set(['iframe', 'frame']);

/**
 * Tells whether a page of ours is requested as a frame of another page of ours (our chrome around it).
 * @param req - The request.
 * @returns True for a same-origin frame; false for Canvas's iframe, a top-level page or no fetch metadata.
 */
const isFramedByOurOrigin = (req: Request): boolean =>
  FRAME_DESTINATIONS.has(req.get('sec-fetch-dest') ?? '') && req.get('sec-fetch-site') === 'same-origin';

/**
 * Middleware that marks a response: the web app runs, so a server page links to its help page, unless our own
 * chrome frames the page and shows Hjelp itself.
 * @returns Express middleware.
 */
export function offerHelpLink(): RequestHandler {
  return (req, res, next) => {
    // WHY: the chrome's header is right above the frame; a second banner and skip link inside it would repeat it.
    if (!isFramedByOurOrigin(req)) res.locals[OFFERED] = true;
    next();
  };
}

/**
 * The help link a server page shows, if any.
 * @param res - The page's response.
 * @param where - `'canvas'` for LTI pages (Canvas's iframe), `'portal'` for portal pages.
 * @returns The link, or undefined when the web app (and so `/hjelp`) does not run or our chrome frames the page.
 */
export function helpLinkFor(res: Response, where: 'portal' | 'canvas'): HelpLink | undefined {
  return res.locals[OFFERED] === true ? { newTab: where === 'canvas' } : undefined;
}
