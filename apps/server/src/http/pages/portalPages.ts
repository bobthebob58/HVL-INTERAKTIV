/**
 * portalPages — sends a friendly page from a portal route (outside Canvas), or the page for an error.
 *
 * Why: the Feide login, logout and portal entry pages answer the browser with HTML, never with JSON or a stack
 *      trace (D-066). One helper gives every such page the same headers: not cached, framed only by our own origin.
 * Spec: AUTH-001, AUTH-003, PROD-004
 * Invariants:
 *   - An HttpError shows its own translated message with its status; another error with a 4xx status (a body
 *     parser's) keeps that status with "bad request"; anything else is a 500 "something went wrong"
 *     page, and only the redacted error reaches the log.
 *   - Pages are `no-store` and carry the portal framing headers.
 * Collaborators: ./messagePage.ts, ../securityHeaders.ts, ../../auth/feide/feideLoginRoutes.ts.
 * Tests: apps/server/test/auth/feide/feideLogin.int.test.ts
 */
import type { Response } from 'express';
import type { Logger } from 'pino';
import type { Locale } from '../../i18n/translate.js';
import { HttpError } from '../HttpError.js';
import { setPortalFrameHeaders } from '../securityHeaders.js';
import { messagePage, type MessagePageInput } from './messagePage.js';

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
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).type('html').send(messagePage(input));
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
