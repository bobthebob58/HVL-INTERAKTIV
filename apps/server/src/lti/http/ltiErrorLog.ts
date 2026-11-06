/**
 * ltiErrorLog — what the LTI error handler (./ltiErrorPages.ts) writes to the log for one refused request: a fixed
 * code, the route pattern, the status and the request ID, and the error itself only when it was unexpected.
 *
 * Why: NFR-006 asks for the route and status of every failure, and DATA-009 forbids personal data and tokens in
 *      the log. A request path is the client's text (`/static/lti/<anything>`, `/lti/play?ltik=…`), and a 4xx error
 *      from serve-static or a body parser carries it too: serve-static's `err.path` and message name the file the
 *      client asked for, and a JSON parse error quotes the body. So the line names the route pattern Express
 *      matched, as ../../http/requestLog.ts does, and a client's error by its status only (step-5 review, D-109).
 * Spec: NFR-006, DATA-009
 * Invariants:
 *   - `route` is the matched route's pattern (`/lti/play`), else the unmatched label of ../../http/requestLog.ts
 *     (`<mount path>/*` or `*`); never `req.path`, `req.url` or the query.
 *   - A known refusal is logged by its fixed `code` (our `errorCode`, the ltijs code or jsonwebtoken's error name);
 *     an error with a client status (4xx from serve-static, body parsers or other middleware) by its status only.
 *   - Only an unexpected error (the 500 page) is logged as `err`, which the logger redacts (../../logging/logger.ts).
 * Collaborators: ./ltiErrorPages.ts, ../../http/requestLog.ts (`routePattern`), ../../http/HttpError.ts.
 * Tests: apps/server/test/lti/http/ltiErrorLog.test.ts
 */
import type { Request, Response } from 'express';
import { HttpError } from '../../http/HttpError.js';
import { routePattern } from '../../http/requestLog.js';

/** The fields of one LTI refusal's log line. */
export interface LtiErrorLogFields {
  /** The matched route pattern, or the unmatched label. */
  readonly route: string;
  /** The status the page or JSON was sent with. */
  readonly status: number;
  /** The request ID that ../../http/requestLog.ts chose, when it runs. */
  readonly requestId?: string;
  /** The refusal's fixed code, for a known refusal that is not a client error. */
  readonly code?: string;
  /** The error itself, only when it was unexpected. */
  readonly err?: unknown;
}

/** How the handler classified the error. */
export type LtiErrorKind = 'known' | 'client' | 'unexpected';

/**
 * The route a request matched, as a pattern.
 * @param req - The request (Express sets `req.route` when a route matches).
 * @returns e.g. `/lti/play`; `*` (or `<mount path>/*`) when no route matched, e.g. a static file's 404.
 */
export function ltiRouteLabel(req: Pick<Request, 'route' | 'baseUrl'>): string {
  const route = req.route as { path?: unknown } | undefined;
  // PRIVACY: the pattern as our code wrote it, never the client's path (DATA-009).
  if (route?.path !== undefined) return routePattern(req.baseUrl, route.path);
  return req.baseUrl ? `${req.baseUrl.toLowerCase()}/*` : '*';
}

/** An ltijs error's message, which is its code (`INVALID_NONCE_RECEIVED`). */
const LTIJS_CODE = /^[A-Z][A-Z_]+$/;

/** The fixed code of a known refusal: ours, the ltijs code, or jsonwebtoken's error name. */
const codeOf = (error: unknown): string | undefined => {
  if (error instanceof HttpError) return error.errorCode;
  if (!(error instanceof Error)) return undefined;
  return LTIJS_CODE.test(error.message) ? error.message : error.name;
};

/**
 * Builds the log fields for one refused LTI request.
 * @param error - What the route, middleware or ltijs threw.
 * @param kind - `known` (a mapped refusal), `client` (a 4xx set by middleware) or `unexpected` (the 500 page).
 * @param req - The request.
 * @param res - The response (its `locals.requestId`).
 * @param status - The status that is sent.
 * @returns The fields; they never hold the request path, query or a client error's message.
 */
export function ltiErrorLogFields(
  error: unknown,
  kind: LtiErrorKind,
  req: Pick<Request, 'route' | 'baseUrl'>,
  res: Pick<Response, 'locals'>,
  status: number,
): LtiErrorLogFields {
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  const base = { route: ltiRouteLabel(req), status, ...(requestId ? { requestId } : {}) };
  // SECURITY: serve-static's error names the asked-for file and a parse error quotes the body: status only.
  if (kind === 'client') return base;
  if (kind === 'known') {
    const code = codeOf(error);
    return code ? { ...base, code } : base;
  }
  return { ...base, err: error };
}
