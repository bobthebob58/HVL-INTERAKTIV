/**
 * HttpError — an error with an HTTP status and a translated message, raised by our own route code.
 *
 * Why: route handlers need one way to say "401, you must sign in" or "400, the request is malformed" that the
 *      error handler turns into a translated JSON answer, without ever showing an internal message.
 * Spec: H5P-006, PROD-012
 * Invariants:
 *   - The message is a locale key. Callers pass a 4xx status (5xx for faults); toErrorResponse turns anything
 *     outside 400–499 into 500.
 * Collaborators: ./h5pErrorResponse.ts, ./h5pLocals.ts.
 * Tests: apps/server/test/http/h5pErrorResponse.test.ts
 */
import type { MessageKey } from '../i18n/translate.js';

/** An expected failure of a request, with the message to show. */
export class HttpError extends Error {
  /**
   * @param status - HTTP status code (4xx or 5xx).
   * @param messageKey - Locale key of the message for the user.
   * @param params - Placeholder values for the message.
   */
  constructor(
    readonly status: number,
    readonly messageKey: MessageKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(`${status} ${messageKey}`);
    this.name = 'HttpError';
  }
}
