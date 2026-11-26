/**
 * lastResortError — the last error handler of the app: whatever no route handled ends here, never in Express's own.
 *
 * Why: Express's built-in final handler prints an unhandled error to standard error with its message and stack
 *      as they are, past the logger that removes personal data and secrets (DATA-009), and outside production it
 *      also sends the stack to the browser. Ending the chain ourselves keeps every fault in the log pipeline and
 *      out of the answer (D-133).
 * Spec: NFR-006, DATA-009, AUTH-003
 * Invariants:
 *   - Before the answer has begun: the friendly error page (./pages/portalPages.ts), which logs through the logger.
 *   - After the answer has begun: one `error` line through the logger, with the method and the route pattern only,
 *     and the connection is closed; a second answer is never written.
 *   - `next` is never called: nothing reaches Express's final handler.
 * Collaborators: ../server/createApp.ts (mounts it last), ./pages/portalPages.ts, ./h5pErrorHandler.ts (the same
 *   rule for `/api` and `/h5p`).
 * Tests: apps/server/test/http/lastResortError.test.ts
 */
import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { sendPortalError } from './pages/portalPages.js';

/**
 * Creates the app's last error handler.
 * @param logger - Server logger.
 * @returns Express error middleware to mount after everything else.
 */
export function lastResortErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    if (!res.headersSent) {
      sendPortalError(res, error, logger);
      return;
    }
    // PRIVACY: the route pattern, never the address: an address can hold a token (NFR-006).
    logger.error(
      { err: error, route: req.route?.path, method: req.method },
      'request failed after its answer began',
    );
    // WHY: part of an answer is already out; closing the connection tells the client it is incomplete.
    res.destroy();
  };
}
