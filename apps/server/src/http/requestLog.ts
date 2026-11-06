/**
 * requestLog — one structured log line per HTTP request: request ID, method, matched route pattern, status and time.
 *
 * Why: NFR-006 asks for structured logs with request ID, route, status and latency, and DATA-009 forbids personal
 *      data and tokens in them. A raw URL carries ltiks, signed file grants and IDs (`/h5p/play/<contentId>?ltik=…`),
 *      and redaction by pattern cannot know every ID, so the line names the route pattern Express matched, never the
 *      path or the query (D-109 and its amendment of 2026-11-04).
 * Spec: NFR-006, DATA-009
 * Invariants:
 *   - One `info` line, `msg: "request"`, when the response closes: `requestId`, `method`, `route`, `status`,
 *     `durationMs` (to 0.1 ms), and `aborted: true` when the client left before the response finished. Nothing else:
 *     no URL, query, header, cookie, body, user, IP address or learner value.
 *   - `route` is the mount path plus the pattern of the last route that matched (`/api/content/:contentId`), taken
 *     when the route matches; a response no route served names its router's mount path with `/*`, or `*` at the top.
 *     Every mount path is static (requestLog.test.ts scans the sources), so `route` never holds an ID.
 *   - The request ID is a well-formed inbound `X-Request-Id` (a UUID or 32 hexadecimal digits, lower-cased), else a
 *     random UUID, so a client cannot write text of its choice into the log. It is sent back in `X-Request-Id` and
 *     kept in `res.locals.requestId` for error logs.
 * Collaborators: ../server/createApp.ts (mounts it first), ../logging/logger.ts (redacts every line again).
 * Tests: apps/server/test/http/requestLog.test.ts, apps/server/test/http/requestLog.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { Logger } from 'pino';

/** The header that carries the request ID, inbound from a proxy and outbound to the client. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

// SECURITY: only shapes that cannot spell a name or carry a token (nginx's `$request_id` is 32 hex digits).
const WELL_FORMED_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Chooses the request ID: a well-formed inbound one, else a new random UUID.
 * @param inbound - The `X-Request-Id` request header as Node parsed it.
 * @returns A lower-case UUID or 32 hexadecimal digits.
 */
export function requestIdFor(inbound: string | string[] | undefined): string {
  return typeof inbound === 'string' && WELL_FORMED_ID.test(inbound) ? inbound.toLowerCase() : randomUUID();
}

/**
 * Joins a router's mount path and a route's pattern.
 * @param mountPath - `req.baseUrl` when the route matched, e.g. `/api`.
 * @param routePath - The route's path as written: a string, a RegExp or a list of them.
 * @returns e.g. `/api/content/:contentId`; `/` alone becomes the mount path.
 */
export function routePattern(mountPath: string, routePath: unknown): string {
  const base = mountPath.toLowerCase();
  const paths = Array.isArray(routePath) ? routePath : [routePath];
  return paths.map((path) => (path === '/' && base ? base : `${base}${String(path)}`)).join('|');
}

/** Records the pattern of each route Express matches for `req`, when it matches. */
const trackRoute = (req: Request): (() => string | undefined) => {
  let route: unknown;
  let pattern: string | undefined;
  // WHY: Express sets `req.route` when a route matches, while `req.baseUrl` is still its router's mount path; by the
  // time the response closes, `baseUrl` may have been restored by an outer router.
  Object.defineProperty(req, 'route', {
    configurable: true,
    enumerable: true,
    get: () => route,
    set: (value: { path?: unknown } | undefined) => {
      route = value;
      pattern = value ? routePattern(req.baseUrl, value.path) : undefined;
    },
  });
  return () => pattern;
};

/** Options for `requestLog`. */
export interface RequestLogOptions {
  /** A monotonic clock in milliseconds; tests pass their own. */
  readonly now?: () => number;
}

/**
 * Middleware that writes one structured line per request and sends the request ID back.
 * @param logger - The application logger (it redacts every line again, DATA-009).
 * @param options - `now`: the clock.
 * @returns Express middleware; mount it before every other.
 */
export function requestLog(logger: Pick<Logger, 'info'>, options: RequestLogOptions = {}): RequestHandler {
  const now = options.now ?? (() => performance.now());
  return (req, res, next) => {
    const started = now();
    const requestId = requestIdFor(req.headers['x-request-id']);
    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.locals.requestId = requestId;
    const matched = trackRoute(req);
    res.once('close', () => {
      // PRIVACY: the pattern, never `req.originalUrl`: paths and queries carry ltiks, grants and IDs (DATA-009).
      const unmatched = req.baseUrl ? `${req.baseUrl.toLowerCase()}/*` : '*';
      logger.info(
        {
          requestId,
          method: req.method,
          route: matched() ?? unmatched,
          status: res.statusCode,
          durationMs: Math.round((now() - started) * 10) / 10,
          ...(res.writableFinished ? {} : { aborted: true }),
        },
        'request',
      );
    });
    next();
  };
}
