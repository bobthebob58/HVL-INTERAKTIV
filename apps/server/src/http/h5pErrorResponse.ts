/**
 * h5pErrorResponse — turns any error from a route into an HTTP status and a translated message.
 *
 * Why: authors and learners must get a clear reason in their own language (nn/nb/en), and the response must
 *      never reveal internal messages, stack traces or file paths. Lumi's own Express error handler returned
 *      raw error messages (D-035); here every known error maps to a locale key and everything else becomes
 *      "something went wrong" with status 500.
 * Spec: PROD-012, H5P-002, SEC-003, H5P-006
 * Invariants:
 *   - The body is H5P's AJAX error shape `{ success: false, errorCode, httpStatusCode, message }`.
 *   - `message` always comes from the locale files; `errorCode` is a stable machine code, never free text.
 *   - Unknown errors and server faults (5xx) are reported as `error.generic`.
 * Collaborators: ./h5pErrorHandler.ts, ./HttpError.ts, ../i18n/translate.ts.
 * Tests: apps/server/test/http/h5pErrorResponse.test.ts
 */
import { MAX_FILE_SIZE } from '../h5p/H5pConfigFactory.js';
import { t, type Locale, type MessageKey } from '../i18n/translate.js';

const MB = 1024 * 1024;

/** The JSON body of an error response (H5P's AjaxErrorResponse shape). */
export interface ErrorBody {
  success: false;
  errorCode: string;
  httpStatusCode: number;
  message: string;
}

type Params = Record<string, string | number>;

/** Lumi and HVL error IDs with their own messages; other 4xx IDs fall back by status. */
const BY_ERROR_ID: Record<string, MessageKey> = {
  'hvl:content-type-not-allowed': 'h5p.contentTypeNotAllowed',
  'hvl:sub-content-not-allowed': 'h5p.subContentNotAllowed',
  'hvl:library-not-installed': 'h5p.libraryNotInstalled',
  'hvl:hub-install-disabled': 'h5p.hubInstallDisabled',
  'hvl:package-libraries-not-installed': 'upload.package.librariesNotInstalled',
  'hvl:package-library-version-mismatch': 'upload.package.libraryVersionMismatch',
  'install-missing-libraries': 'upload.package.librariesNotInstalled',
  'missing-h5p-extension': 'upload.package.notH5p',
  'unable-to-unzip': 'upload.archive.unreadable',
};

const BY_STATUS: Record<number, MessageKey> = {
  400: 'error.badRequest',
  401: 'error.unauthenticated',
  403: 'error.forbidden',
  404: 'error.notFound',
  413: 'error.tooLarge',
};

interface Described {
  status: number;
  code: string;
  key: MessageKey;
  params: Params;
}

const stringParams = (value: unknown): Params =>
  Object.fromEntries(
    Object.entries(typeof value === 'object' && value !== null ? value : {}).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'number',
    ),
  );

function describe(error: unknown): Described {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  // Errors that carry their own message key: HttpError, ZipRejectedError, RejectedUploadError.
  if (typeof e.messageKey === 'string') {
    // WHY: size limits (`upload.file.tooLarge`, `upload.archive.fileTooLarge`, …) are 413; other refusals 400.
    const status = typeof e.status === 'number' ? e.status : /toolarge$/i.test(e.messageKey) ? 413 : 400;
    return { status, code: e.messageKey, key: e.messageKey as MessageKey, params: stringParams(e.params) };
  }
  // Lumi's H5pError: errorId, replacements, httpStatusCode.
  if (typeof e.errorId === 'string' && typeof e.httpStatusCode === 'number') {
    const status = e.httpStatusCode;
    const key = BY_ERROR_ID[e.errorId] ?? BY_STATUS[status];
    if (key) return { status, code: e.errorId, key, params: stringParams(e.replacements) };
  }
  // Body parsers and busboy report size limits with status 413.
  if (e.status === 413 || e.statusCode === 413) {
    const limit = typeof e.limit === 'number' ? e.limit : MAX_FILE_SIZE;
    return {
      status: 413,
      code: 'too-large',
      key: 'error.tooLarge',
      params: { maxMb: Math.ceil(limit / MB) },
    };
  }
  return { status: 500, code: 'internal', key: 'error.generic', params: {} };
}

/**
 * Builds the HTTP answer for an error.
 * @param error - Anything a route threw.
 * @param locale - Language of the message.
 * @returns Status code and JSON body.
 */
export function toErrorResponse(error: unknown, locale: Locale): { status: number; body: ErrorBody } {
  const described = describe(error);
  const serverFault = described.status < 400 || described.status >= 500;
  const { status, code, key, params } = serverFault
    ? { status: 500, code: 'internal', key: 'error.generic' as MessageKey, params: {} }
    : described;
  return {
    status,
    body: { success: false, errorCode: code, httpStatusCode: status, message: t(key, params, locale) },
  };
}
