/**
 * PublishBlockedError — the 409 refusal of a publish (or of a save of a published activity) while errors without an
 * acknowledgement remain; it carries the findings for the answer.
 *
 * Why: PROD-003 lists the findings so the author can fix or explain each error. The error answer keeps the usual
 *      shape and adds `findings` (../http/h5pErrorResponse.ts), so the client needs no second request.
 * Spec: PROD-003, UD-022
 * Invariants:
 *   - Status, message key and machine code come from ../http/authErrors.ts.
 *   - `findings` are the server's own findings, annotated with stored acknowledgements; never client data.
 * Collaborators: ./ContentPublisher.ts, ./PublishedSaveGate.ts, ../http/h5pErrorResponse.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/content/publishedSave.int.test.ts
 */
import { AUTH_ERRORS } from '../http/authErrors.js';
import { HttpError } from '../http/HttpError.js';
import type { CoveredFinding } from './acknowledgementCoverage.js';

/** Which refusal: a blocked publish, or a blocked save of an already published activity. */
export type PublishBlockedCode = 'hvl:publish-blocked' | 'hvl:published-save-blocked';

/** Errors without a valid acknowledgement remain (409). */
export class PublishBlockedError extends HttpError {
  /**
   * @param findings - Every current finding, with the acknowledgements stored so far.
   * @param code - `hvl:publish-blocked` (publish) or `hvl:published-save-blocked` (save of a published activity).
   */
  constructor(
    readonly findings: readonly CoveredFinding[],
    code: PublishBlockedCode = 'hvl:publish-blocked',
  ) {
    super(AUTH_ERRORS[code][0], AUTH_ERRORS[code][1], {}, code);
    this.name = 'PublishBlockedError';
  }
}
