/**
 * authErrors — the HTTP errors of authentication, LTI, sharing and publishing, each with a fixed status, locale
 * key and stable machine code.
 *
 * Why: the session, CSRF, ltik, signed-file, Deep Linking and publish code all refuse requests, and tests, the H5P
 *      client and the web app read the machine code (`hvl:csrf-invalid`, …). One table keeps status, code and
 *      message together, so two modules cannot answer the same failure differently (D-057, D-058, D-066, D-074).
 * Spec: H5P-007, AUTH-003, LTI-003, LTI-005, PROD-004, PROD-006, PROD-003
 * Invariants:
 *   - Every code starts with `hvl:` and maps to exactly one status and locale key.
 *   - "Not available" is one answer (404) for unknown, draft and invisible activities, so a refusal never
 *     reveals that an activity exists (D-066).
 *   - Only `hvl:feide-groups-unavailable` is a deliberate 503 (fail closed, D-054).
 * Collaborators: ./HttpError.ts, ./h5pErrorResponse.ts, ../auth/, ../lti/.
 * Tests: apps/server/test/http/authErrors.test.ts, apps/server/test/http/api/publishGuards.int.test.ts
 */
import type { MessageKey } from '../i18n/translate.js';
import { HttpError } from './HttpError.js';

/** Every authentication, authorisation and publishing refusal: its stable code, HTTP status and message key. */
export const AUTH_ERRORS = {
  'hvl:unauthenticated': [401, 'error.unauthenticated'],
  'hvl:csrf-invalid': [401, 'error.csrfInvalid'],
  'hvl:session-expired': [401, 'error.sessionExpired'],
  'hvl:ltik-invalid': [401, 'error.ltikInvalid'],
  'hvl:login-failed': [400, 'error.loginFailed'],
  'hvl:deep-link-choice-invalid': [400, 'error.deepLinkChoiceInvalid'],
  'hvl:acknowledgement-invalid': [400, 'error.acknowledgementInvalid'],
  'hvl:no-feide-id': [403, 'error.noFeideId'],
  'hvl:deployment-not-allowed': [403, 'error.deploymentNotAllowed'],
  'hvl:deep-link-not-allowed': [403, 'error.deepLinkNotAllowed'],
  'hvl:file-grant-invalid': [403, 'error.fileGrantInvalid'],
  'hvl:sharing-not-allowed': [403, 'error.sharingNotAllowed'],
  'hvl:edit-not-allowed': [403, 'error.editNotAllowed'],
  'hvl:activity-unavailable': [404, 'error.activityUnavailable'],
  'hvl:deep-link-draft': [409, 'error.deepLinkDraft'],
  'hvl:sharing-changed': [409, 'error.sharingChanged'],
  'hvl:content-changed': [409, 'error.contentChanged'],
  'hvl:publish-blocked': [409, 'error.publishBlocked'],
  'hvl:published-save-blocked': [409, 'error.publishedSaveBlocked'],
  'hvl:feide-groups-unavailable': [503, 'error.feideGroupsUnavailable'],
} as const satisfies Record<string, readonly [number, MessageKey]>;

/** A machine code of an authentication, LTI, sharing or publishing refusal. */
export type AuthErrorCode = keyof typeof AUTH_ERRORS;

/** Codes whose 503 is deliberate and shown to the user as such. */
export const SERVICE_UNAVAILABLE_CODES: ReadonlySet<string> = new Set(
  Object.entries(AUTH_ERRORS)
    .filter(([, [status]]) => status === 503)
    .map(([code]) => code),
);

/**
 * Builds the error for a refusal.
 * @param code - Which refusal.
 * @returns An HttpError with the code's status, message key and machine code.
 */
export function authError(code: AuthErrorCode): HttpError {
  const [status, key] = AUTH_ERRORS[code];
  return new HttpError(status, key, {}, code);
}

/**
 * Tells whether an error is a given refusal.
 * @param error - Anything thrown.
 * @param code - The refusal to test for.
 * @returns True when `error` came from `authError(code)`.
 */
export const isAuthError = (error: unknown, code: AuthErrorCode): boolean =>
  error instanceof HttpError && error.errorCode === code;
