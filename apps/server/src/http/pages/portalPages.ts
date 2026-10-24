/**
 * portalPages — sends a friendly page from a portal route (outside Canvas), or the page for an error.
 *
 * Why: the Feide login, logout and portal entry pages answer the browser with HTML, never with JSON or a stack
 *      trace (D-066). One helper gives every such page the same headers: not cached, framed only by our own origin,
 *      and a policy that lets them load our own files only, as DATA-011 asks of student-facing pages (the 404 of
 *      an unavailable activity is one).
 * Spec: AUTH-001, AUTH-003, PROD-004, DATA-011, UD-013
 * Invariants:
 *   - An HttpError shows its own translated message with its status; another error with a 4xx status (a body
 *     parser's) keeps that status with "bad request"; anything else is a 500 "something went wrong"
 *     page, and only the redacted error reaches the log.
 *   - Pages are `no-store`, carry the portal framing headers and `portalPageCsp()`, set here and not in
 *     `setPortalFrameHeaders`, which the H5P pages call before they set their own policy.
 *   - Pages show the Hjelp header whenever the web app runs, except inside our own chrome's frame, whose header
 *     already has it (./helpLink.ts, UD-013).
 * Collaborators: ./messagePage.ts, ./helpLink.ts, ../securityHeaders.ts, ../../auth/feide/feideLoginRoutes.ts.
 * Tests: apps/server/test/http/pages/portalPages.test.ts, apps/server/test/auth/feide/feideLogin.int.test.ts,
 *   apps/server/test/server/createApp.int.test.ts
 */
import type { Response } from 'express';
import type { Logger } from 'pino';
import type { Locale } from '../../i18n/translate.js';
import { HttpError } from '../HttpError.js';
import { setPortalFrameHeaders } from '../securityHeaders.js';
import { helpLinkFor } from './helpLink.js';
import { messagePage, type MessagePageInput } from './messagePage.js';

/**
 * The policy of a server-rendered portal page: our own scripts, styles, images and requests only (DATA-011, D-048),
 * no inline script or style, framed only by our own origin.
 * @param options - `formAction: false` leaves `form-action` out, for a form whose redirect leaves our origin.
 * @returns The header value.
 */
export function portalPageCsp(options: { readonly formAction?: boolean } = {}): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    // WHY: a portal page's script (or the e2e flow, PROD-006) asks `/auth/session`; like `ltiPageCsp`, first-party.
    "connect-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    ...(options.formAction === false ? [] : ["form-action 'self'"]),
    "frame-ancestors 'self'",
  ].join('; ');
}

/** The 4xx status a body parser or other middleware set on its error, if any. */
const clientStatusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = typeof status === 'number' ? status : statusCode;
  return typeof value === 'number' && value >= 400 && value < 500 ? value : undefined;
};

/**
 * Sends a message page.
 * @param res - The response.
 * @param status - The HTTP status.
 * @param input - Language, heading, sentence and optional link.
 */
export function sendPortalPage(res: Response, status: number, input: MessagePageInput): void {
  setPortalFrameHeaders(res);
  // SECURITY: replaces the frame-only policy, and the H5P policy of a player route that answers "not available".
  res.setHeader('Content-Security-Policy', portalPageCsp());
  res.setHeader('Cache-Control', 'no-store');
  res
    .status(status)
    .type('html')
    .send(messagePage({ ...input, help: helpLinkFor(res, 'portal') }));
}

/**
 * Sends the page for an error a portal route threw.
 * @param res - The response.
 * @param error - What was thrown.
 * @param logger - Where unexpected errors are logged (redacted).
 * @param locale - The page language.
 */
export function sendPortalError(res: Response, error: unknown, logger: Logger, locale: Locale = 'nn'): void {
  if (error instanceof HttpError && error.status >= 400 && error.status < 600) {
    logger.warn({ errorCode: error.errorCode, status: error.status }, 'portal request refused');
    sendPortalPage(res, error.status, { locale, titleKey: 'page.error.title', bodyKey: error.messageKey });
    return;
  }
  const status = clientStatusOf(error);
  if (status !== undefined) {
    // WHY: a body parser's 4xx (too large, wrong charset, bad form) is the request's fault, not the server's.
    logger.warn({ status }, 'portal request refused');
    sendPortalPage(res, status, { locale, titleKey: 'page.error.title', bodyKey: 'error.badRequest' });
    return;
  }
  logger.error({ err: error }, 'portal request failed');
  sendPortalPage(res, 500, { locale, titleKey: 'page.error.title', bodyKey: 'error.generic' });
}
