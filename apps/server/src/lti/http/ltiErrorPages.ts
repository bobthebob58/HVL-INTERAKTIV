/**
 * ltiErrorPages — the error handler for every `/lti/*` route: a friendly page (or JSON for API calls) instead of
 * ltijs's JSON errors or a stack trace.
 *
 * Why: LTI-001 rejects launches with a wrong signature, audience, nonce or deployment and LTI-003 answers an
 *      invalid ltik with "please reopen from Canvas"; the person in the Canvas iframe must read a sentence in their
 *      language, while the log keeps only a fixed code (D-050, D-066). Failed launches are audited (D-064).
 * Spec: LTI-001, LTI-003, LTI-006, PROD-004
 * Invariants:
 *   - Each failure class maps to one status and one message; our other 4xx errors keep their status and message;
 *     unknown errors are 500 "something went wrong".
 *   - Nothing from the error (message, claims, token) reaches the page; the log gets the code and redacted error.
 *   - Pages carry the LTI headers (no-store, no-referrer, frame-ancestors = Canvas origins).
 * Collaborators: ./ltiPageHeaders.ts, ../../http/authErrors.ts, ../../http/pages/messagePage.ts,
 *   ../../auth/audit/AuthAuditRecorder.ts.
 * Tests: apps/server/test/lti/http/ltiErrorPages.test.ts
 */
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { AuthAuditReason, AuthAuditRecorder } from '../../auth/audit/AuthAuditRecorder.js';
import { toErrorResponse } from '../../http/h5pErrorResponse.js';
import { HttpError } from '../../http/HttpError.js';
import { messagePage } from '../../http/pages/messagePage.js';
import type { MessageKey } from '../../i18n/translate.js';
import { ltiPageCsp, setLtiPageHeaders } from './ltiPageHeaders.js';

/** How one class of failure is answered. */
interface LtiFailure {
  readonly status: number;
  readonly titleKey: MessageKey;
  readonly bodyKey: MessageKey;
  readonly reason: AuthAuditReason | undefined;
}

const failure = (
  status: number,
  titleKey: MessageKey,
  bodyKey: MessageKey,
  reason?: AuthAuditReason,
): LtiFailure => ({ status, titleKey, bodyKey, reason });

const REOPEN = failure(401, 'page.reopen.title', 'page.reopen.body');
const LAUNCH_FAILED = (reason: AuthAuditReason) =>
  failure(400, 'page.error.title', 'error.launchFailed', reason);

/** ltijs error codes (the error message is the code), by what they mean for the user. */
const BY_LTIJS_CODE: Record<string, LtiFailure> = {
  PLATFORM_NOT_FOUND: failure(400, 'page.error.title', 'error.platformNotRegistered', 'platform-unknown'),
  UNREGISTERED_PLATFORM: failure(400, 'page.error.title', 'error.platformNotRegistered', 'platform-unknown'),
  PLATFORM_NOT_ACTIVATED: failure(
    403,
    'page.error.title',
    'error.platformNotRegistered',
    'platform-inactive',
  ),
  INVALID_LTIK: REOPEN,
  SESSION_NOT_FOUND: REOPEN,
  INVALID_STATE: LAUNCH_FAILED('state-invalid'),
  INVALID_NONCE_RECEIVED: LAUNCH_FAILED('nonce-invalid'),
  TOKEN_TOO_OLD: LAUNCH_FAILED('token-invalid'),
  INVALID_ALG: LAUNCH_FAILED('token-invalid'),
  AZP_DOES_NOT_MATCH_CLIENTID: LAUNCH_FAILED('token-invalid'),
  AUTHCONFIG_NOT_FOUND: LAUNCH_FAILED('token-invalid'),
  INVALID_MESSAGE_TYPE: LAUNCH_FAILED('launch-invalid'),
  MISSING_OR_INVALID_RESOURCE_LINK_ID: LAUNCH_FAILED('launch-invalid'),
};

/** Our own refusals, by their stable code. */
const BY_AUTH_CODE: Record<string, LtiFailure> = {
  'hvl:deployment-not-allowed': failure(
    403,
    'page.error.title',
    'error.deploymentNotAllowed',
    'deployment-not-allowed',
  ),
  'hvl:ltik-invalid': REOPEN,
  'hvl:activity-unavailable': failure(404, 'page.notAvailable.title', 'page.notAvailable.body'),
  'hvl:deep-link-not-allowed': failure(403, 'page.error.title', 'error.deepLinkNotAllowed'),
  'hvl:deep-link-draft': failure(409, 'page.error.title', 'error.deepLinkDraft'),
  'hvl:deep-link-choice-invalid': failure(400, 'page.error.title', 'error.deepLinkChoiceInvalid'),
};

/** The 4xx status a body parser or another middleware set on its error, if any. */
const clientStatusOf = (error: unknown): number | undefined => {
  const status =
    typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
};

/** jsonwebtoken's error names (signature, audience, expiry), which ltijs lets through. */
const JWT_ERRORS = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError', 'ValidationError']);

/**
 * Classifies an error thrown on an LTI route.
 * @param error - Anything a route or ltijs threw.
 * @returns How to answer it, or undefined for an unexpected error.
 */
export function classifyLtiError(error: unknown): LtiFailure | undefined {
  if (error instanceof HttpError) {
    const own = BY_AUTH_CODE[error.errorCode];
    if (own || error.status >= 500) return own;
    return failure(error.status, 'page.error.title', error.messageKey);
  }
  if (!(error instanceof Error)) return undefined;
  const clientStatus = clientStatusOf(error);
  // WHY: a malformed JSON body on an LTI API call is the request's fault, like in the H5P routes.
  if (clientStatus !== undefined && !(error.message in BY_LTIJS_CODE)) {
    return failure(clientStatus, 'page.error.title', 'error.badRequest');
  }
  return (
    BY_LTIJS_CODE[error.message] ?? (JWT_ERRORS.has(error.name) ? LAUNCH_FAILED('token-invalid') : undefined)
  );
}

/**
 * Builds the error handler for `/lti/*`.
 * @param deps - Canvas origins, logger and the audit recorder.
 * @returns An Express error middleware.
 */
export function ltiErrorPages(deps: {
  canvasOrigins: readonly string[];
  logger: Logger;
  audit: Pick<AuthAuditRecorder, 'record'>;
}) {
  return async (error: unknown, req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (res.headersSent) return next(error);
    const known = classifyLtiError(error);
    const answer = known ?? failure(500, 'page.error.title', 'error.generic');
    deps.logger[known ? 'warn' : 'error'](
      { err: error, path: req.path, status: answer.status },
      'LTI request refused',
    );
    if (req.path === '/lti/launch' && answer.reason) {
      await deps.audit.record({ event: 'launch.lti.failed', reason: answer.reason, ip: req.ip });
    }
    setLtiPageHeaders(res, ltiPageCsp(deps.canvasOrigins));
    if (req.accepts(['html', 'json']) === 'json') {
      const ours = error instanceof HttpError || clientStatusOf(error) !== undefined;
      const body = known && ours ? toErrorResponse(error, 'nn').body : undefined;
      res.status(answer.status).json(body ?? { success: false, httpStatusCode: answer.status });
      return;
    }
    // WHY: the person's language is unknown when a launch fails; Nynorsk is the service default (PROD-012).
    res
      .status(answer.status)
      .type('html')
      .send(messagePage({ locale: 'nn', titleKey: answer.titleKey, bodyKey: answer.bodyKey }));
  };
}
