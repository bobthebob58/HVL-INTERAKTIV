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
 * Collaborators: ./ltiPageHeaders.ts, ../LtiProviderFactory.ts, ../pages/client/ltijsStorageGuard.js.
 * Tests: apps/server/test/lti/http/ExpressRouterHttpHandler.test.ts
 */
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import type { HttpHandler, HttpMethod, HttpRequestParameters, HttpResponse, RouteHandler } from 'ltijs';
import { ltijsPageCsp, setLtiPageHeaders } from './ltiPageHeaders.js';

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
 * @returns ltijs's HttpResponse.
 */
export function toLtijsResponse(res: Response, canvasOrigins: readonly string[]): HttpResponse {
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
      setLtiPageHeaders(res, ltijsPageCsp(page, canvasOrigins));
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
   */
  constructor(private readonly canvasOrigins: readonly string[]) {}

  /**
   * Called by the ltijs Provider constructor for each of its routes.
   * @param path - e.g. `/lti/launch`.
   * @param methods - HTTP methods; `ALL` means any.
   * @param handler - ltijs's handler.
   */
  registerRoute(path: string, methods: HttpMethod[], handler: RouteHandler): void {
    const run = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const request: HttpRequestParameters = {
        method: req.method,
        path: req.path,
        query: fieldsOf(req.query) as Record<string, string | string[]>,
        body: fieldsOf(req.body),
        headers: headersOf(req),
      };
      try {
        await handler(request, toLtijsResponse(res, this.canvasOrigins));
      } catch (error) {
        next(error);
      }
    };
    const form = express.urlencoded({ extended: false, limit: FORM_LIMIT });
    for (const method of methods) {
      const verb = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'all';
      this.router[verb](path, form, run);
    }
  }

  /** Does nothing: our server listens, not ltijs. */
  async listen(): Promise<void> {}

  /** Does nothing: our server closes, not ltijs. */
  async close(): Promise<void> {}
}
