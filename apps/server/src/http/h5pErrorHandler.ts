/**
 * h5pErrorHandler — the last middleware of the H5P router: logs the failure and sends the translated answer.
 *
 * Why: a route can fail before or after it has started to stream a file. Before, the person gets a translated
 *      JSON error (./h5pErrorResponse.ts). After, headers are already sent: the only safe move is to end the
 *      connection, never to write a second answer (Lumi's Express 4 handler crashed the process here, D-035).
 * Spec: H5P-006, DATA-009, NFR-006
 * Invariants:
 *   - Server faults are logged at error level with the error object (the logger redacts personal data).
 *   - Expected 4xx answers are logged at debug level with their code only.
 *   - A JSON error never carries a file's length, range or download headers, and is always
 *     `Cache-Control: no-store`: it is about one request, and a 409 can list the author's texts and reasons.
 * Collaborators: ./h5pErrorResponse.ts, ./h5pLocals.ts, ../logging/logger.ts, ../server/createApp.ts (mounts it on
 *   `/api` and `/h5p`).
 * Tests: apps/server/test/http/router.int.test.ts, apps/server/test/http/api/publishRoutes.int.test.ts
 */
import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { toErrorResponse } from './h5pErrorResponse.js';
import { localeOf } from './h5pLocals.js';

/** Headers of a file answer that must not reach a JSON error answer. */
const FILE_HEADERS = [
  'Content-Type',
  'Content-Length',
  'Content-Range',
  'Content-Disposition',
  'Accept-Ranges',
  'Cache-Control',
];

/**
 * Creates the error handler.
 * @param logger - Server logger.
 * @returns Express error middleware.
 */
export function h5pErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const { status, body } = toErrorResponse(error, localeOf(res));
    if (status >= 500)
      logger.error({ err: error, route: req.route?.path, method: req.method }, 'h5p request failed');
    else logger.debug({ code: body.errorCode, status }, 'h5p request refused');
    if (res.headersSent) {
      res.destroy();
      return;
    }
    // WHY: a file route may have set the file's type, length, range and download name before it failed.
    for (const header of FILE_HEADERS) res.removeHeader(header);
    // PRIVACY: removing the file's caching header must not leave the error cacheable; `/api` promises no-store.
    res.set('Cache-Control', 'no-store');
    res.status(status).json(body);
  };
}
