/**
 * ExpressRouterHttpHandler — runs ltijs's login, launch and keyset routes on an Express router that we mount,
 * instead of ltijs's own Express app.
 *
 * Why: ltijs's `ExpressHttpHandler` builds its own app with permissive CORS and helmet defaults, and
 *      `Provider.listen()` installs a SIGINT handler that exits the process (D-050). Our router keeps ltijs inside
 *      our app: our headers, our body limits, our error pages and our logger.
 * Spec: LTI-001, LTI-003
 * Invariants:
 *   - `listen` and `close` do nothing: the server's lifecycle is ours, and `Provider.listen()` is never called.
 *   - ltijs receives Express's lower-case `req.headers` unchanged, so its `Sec-Fetch-Site` check runs (D-050).
 *   - Every ltijs response is `no-store` and `no-referrer`, framed only by `CANVAS_ORIGINS`; HTML gets a CSP that
 *     allows its inline scripts by hash, and our storage guard runs before them.
 *   - A handler error goes to `next(error)`, where the LTI error pages answer; ltijs's own JSON errors never reach
 *     a user.
 *   - A query or form field with a control character is refused (400) before ltijs reads any field, so none is
 *     used for a lookup or stored (../ltiInputText.ts).
 *   - The last step of a launch is taken only from our own page, also from a browser that sends no fetch
 *     metadata (./launchPostOrigin.ts, D-141); ltijs's launch page is sent with `Referrer-Policy: same-origin`.
 *   - `before` runs ahead of the body parser on every ltijs route (the request ceiling,
 *     ./launchRequestCeiling.ts), so a refused request costs neither the read nor the parse.
 * Collaborators: ./ltiPageHeaders.ts, ./launchPostOrigin.ts, ../ltiInputText.ts, ../LtiProviderFactory.ts,
 *   ../pages/client/ltijsStorageGuard.js.
 * Tests: apps/server/test/lti/http/ExpressRouterHttpHandler.test.ts
 */
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import type { Router } from 'express';
import type { HttpHandler, HttpMethod, HttpRequestParameters, HttpResponse, RouteHandler } from 'ltijs';
import { assertLaunchFields } from '../ltiInputText.js';
import { assertLastStepFromOwnPage } from './launchPostOrigin.js';
import { ltijsPageCsp, setLtiPageHeaders } from './ltiPageHeaders.js';

/** What the handler knows about the launch route and what runs ahead of every ltijs route. */
export interface LaunchRouteRules {
  /** The launch route's path (../LtiProviderFactory.ts `LTI_ROUTES.launchRoute`). */
  readonly route: string;
  /** Our own origin (`PUBLIC_BASE_URL`), which the last step of a launch must come from. */
  readonly ownOrigin: string;
  /** Runs before the body is read on every ltijs route; none in unit tests. */
  readonly before?: RequestHandler;
}

/** Path of the script that keeps ltijs's pages working when the browser blocks frame storage. */
export const STORAGE_GUARD_SCRIPT = '/static/lti/ltijsStorageGuard.js';

// WHY: an id_token is a few kilobytes; nothing an LTI platform posts comes close to this.
const FORM_LIMIT = '64kb';

const headersOf = (req: Request): Record<string, string | string[]> =>
  Object.fromEntries(
    Object.entries(req.headers).filter(
      (entry): entry is [string, string | string[]] => entry[1] !== undefined,
    ),
  );

const fieldsOf = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * Wraps an Express response in the shape ltijs writes to.
 * @param res - The Express response.
 * @param canvasOrigins - Origins that may frame the page.
 * @param launchPage - True on the launch route, whose HTML is the page that posts the launch to us again.
 * @returns ltijs's HttpResponse.
 */
export function toLtijsResponse(
  res: Response,
  canvasOrigins: readonly string[],
  launchPage = false,
): HttpResponse {
  const response: HttpResponse = {
    status: (code) => {
      res.status(code);
      return response;
    },
    redirect: (url) => {
      setLtiPageHeaders(res, ltijsPageCsp('', canvasOrigins));
      res.redirect(url);
    },
    html: (content) => {
      // UPSTREAM: https://github.com/Cvmcosta/ltijs/issues (no issue yet) — ltijs 7.0.7's launch page
      // (services/launch/templates/signed-state-form.spy) calls localStorage.removeItem outside its try block, which
      // throws where frame storage is blocked, so the launch never submits; the guard runs first (D-050).
      // Remove when an ltijs release guards every storage access in its templates.
      const page = `<script src="${STORAGE_GUARD_SCRIPT}"></script>\n${content}`;
      // SECURITY: under `same-origin` the page's own post names our origin in `Origin` (./launchPostOrigin.ts).
      setLtiPageHeaders(res, ltijsPageCsp(page, canvasOrigins), launchPage ? 'same-origin' : 'no-referrer');
      res.type('html').send(page);
    },
    json: (body) => {
      setLtiPageHeaders(res, ltijsPageCsp('', canvasOrigins));
      res.json(body);
    },
  };
  return response;
}

/** ltijs's HttpHandler on an Express router. */
export class ExpressRouterHttpHandler implements HttpHandler {
  /** Mount this in the app (at `/`); it holds ltijs's routes. */
  readonly router: Router = express.Router();

  /**
   * @param canvasOrigins - `CANVAS_ORIGINS`, for `frame-ancestors`.
   * @param launch - The launch route, our own origin and what runs ahead of every route.
   */
  constructor(
    private readonly canvasOrigins: readonly string[],
    private readonly launch: LaunchRouteRules,
  ) {}

  /**
   * Called by the ltijs Provider constructor for each of its routes.
   * @param path - e.g. `/lti/launch`.
   * @param methods - HTTP methods; `ALL` means any.
   * @param handler - ltijs's handler.
   */
  registerRoute(path: string, methods: HttpMethod[], handler: RouteHandler): void {
    const isLaunch = path === this.launch.route;
    const run = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const request: HttpRequestParameters = {
        method: req.method,
        path: req.path,
        query: fieldsOf(req.query) as Record<string, string | string[]>,
        body: fieldsOf(req.body),
        headers: headersOf(req),
      };
      try {
        assertLaunchFields(request.query, request.body);
        // SECURITY: before ltijs reads the request, so its own check never decides alone (D-141).
        if (isLaunch) assertLastStepFromOwnPage(request.body, request.headers, this.launch.ownOrigin);
        await handler(request, toLtijsResponse(res, this.canvasOrigins, isLaunch));
      } catch (error) {
        next(error);
      }
    };
    const form = express.urlencoded({ extended: false, limit: FORM_LIMIT });
    const before = this.launch.before ? [this.launch.before] : [];
    for (const method of methods) {
      const verb = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'all';
      this.router[verb](path, ...before, form, run);
    }
  }

  /** Does nothing: our server listens, not ltijs. */
  async listen(): Promise<void> {}

  /** Does nothing: our server closes, not ltijs. */
  async close(): Promise<void> {}
}
