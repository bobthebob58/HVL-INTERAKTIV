/**
 * apiRequest — every request the web app makes to the Express API, from the browser, with the right credential: JSON
 * answers (`apiRequest`) and file answers for downloads (`apiFileRequest`).
 *
 * Why: Express removes cookies and tokens before Next.js renders a page (D-068), so pages fetch their data in the
 *      browser. Portal pages send the session cookie and, for PUT, POST, PATCH and DELETE, the CSRF token from
 *      `GET /auth/session` (D-057); LTI pages send the ltik as `Authorization: Bearer` and no cookie (LTI-003).
 *      D-099 adds `DELETE` (removing a co-author or a bank listing) and answers that are files (the portfolio's
 *      Markdown and PDF, MAPPE-001), which the page hands to the browser to save.
 * Spec: AUTH-003, LTI-003, DOC-012, MAPPE-001
 * Invariants:
 *   - The ltik goes only into the Authorization header of same-origin requests, never into a URL here.
 *   - Requests are never cached (`no-store`), like every `/api` answer; a file answer is kept only in the result.
 *   - Never throws: a network failure, or a body that cannot be read, is `{ ok: false, status: 0 }`.
 *   - A refused file request answers JSON like any other route, so its error body is read the same way.
 * Collaborators: ./contentApi.ts, ./meApi.ts, ./portalSession.ts, ./ApiAuthContext.tsx, ./contentDisposition.ts,
 *   packages/api-contract (`ErrorBody`, `CSRF_HEADER_NAME`, `ApiFileMediaType`).
 * Tests: apps/web/test/api/apiRequest.test.ts, apps/web/test/api/apiFileRequest.test.ts
 */
import type { ErrorBody } from '@hvl-interaktiv/api-contract';
import { filenameFromDisposition } from './contentDisposition';

/** The header that carries the CSRF token; the same name as api-contract's `CSRF_HEADER_NAME` (a test checks it). */
export const CSRF_HEADER = 'x-csrf-token';

/** How a request proves who sends it. */
export type ApiAuth =
  /** A Feide session: the cookie, plus the CSRF token for unsafe methods once it is known. */
  | { readonly kind: 'portal'; readonly csrfToken?: string }
  /** A Canvas launch: the ltik, kept in page memory only. */
  | { readonly kind: 'lti'; readonly ltik: string };

/** The methods the API uses; every one but GET carries the CSRF token on a portal page. */
export type ApiMethod = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE';

/** A refused or failed request: the status (0 when the server could not be reached) and the server's error body. */
export interface ApiFailure {
  readonly ok: false;
  readonly status: number;
  /** The server's error body, when the answer was one (`errorCode`, translated `message`). */
  readonly error?: ErrorBody;
  /** The parsed JSON answer, whatever its shape. */
  readonly body?: unknown;
}

/** The outcome of a request: data, or the status and the server's error body. */
export type ApiResult<T> = { readonly ok: true; readonly status: number; readonly data: T } | ApiFailure;

const isErrorBody = (value: unknown): value is ErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ErrorBody).errorCode === 'string' &&
  typeof (value as ErrorBody).message === 'string';

/**
 * The headers of a request.
 * @param auth - The credential.
 * @param method - The HTTP method.
 * @param json - Whether the request has a JSON body.
 * @param accept - The answer's media type; JSON unless a file is asked for.
 * @returns The header map.
 */
export function apiHeaders(
  auth: ApiAuth,
  method: ApiMethod,
  json: boolean,
  accept = 'application/json',
): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept };
  if (json) headers['Content-Type'] = 'application/json';
  // SECURITY: the ltik is a bearer credential for the launch (LTI-003); it travels only in this header.
  if (auth.kind === 'lti') headers.Authorization = `Bearer ${auth.ltik}`;
  // SECURITY: the synchronizer token defeats cross-site requests that carry the session cookie (AUTH-003).
  if (auth.kind === 'portal' && method !== 'GET' && auth.csrfToken) headers[CSRF_HEADER] = auth.csrfToken;
  return headers;
}

/** The method and JSON body of a request. */
export interface ApiRequestOptions {
  readonly method?: ApiMethod;
  readonly body?: unknown;
}

const send = async (
  path: string,
  auth: ApiAuth,
  options: ApiRequestOptions,
  accept: string,
): Promise<Response | undefined> => {
  const method = options.method ?? 'GET';
  const json = options.body !== undefined;
  try {
    return await fetch(path, {
      method,
      headers: apiHeaders(auth, method, json, accept),
      body: json ? JSON.stringify(options.body) : undefined,
      // PRIVACY: an LTI page sends no cookie, so the launch is the only principal (LTI-003).
      credentials: auth.kind === 'lti' ? 'omit' : 'same-origin',
      // WHY: like every `/api` answer, a file is not kept in the browser's HTTP cache (MAPPE-003 stores no export).
      cache: 'no-store',
    });
  } catch {
    return undefined;
  }
};

const refusal = (status: number, body: unknown): ApiFailure =>
  isErrorBody(body) ? { ok: false, status, error: body, body } : { ok: false, status, body };

const readBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return undefined;
  return response.json().catch(() => undefined);
};

/**
 * Sends one request to the API.
 * @param path - A same-origin path, e.g. `/api/content`.
 * @param auth - The credential.
 * @param options - Method and JSON body.
 * @returns The data, or the status and error body; never throws.
 */
export async function apiRequest<T>(
  path: string,
  auth: ApiAuth,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const response = await send(path, auth, options, 'application/json');
  if (!response) return { ok: false, status: 0 };
  const body = await readBody(response);
  if (response.ok) return { ok: true, status: response.status, data: body as T };
  return refusal(response.status, body);
}

/** The outcome of a request whose answer is a file (D-099): the file, or the status and the server's error body. */
export type ApiFileResult =
  | {
      readonly ok: true;
      readonly status: number;
      /** The file, typed with the answer's `Content-Type`. */
      readonly blob: Blob;
      /** The answer's `Content-Type`, e.g. `application/pdf`. */
      readonly mediaType: string;
      /** The name the server suggests (`Content-Disposition`), without any folder; absent when it gave none. */
      readonly filename?: string;
    }
  | ApiFailure;

/**
 * Sends one request whose answer is a file, e.g. the portfolio export (MAPPE-001).
 * @param path - A same-origin path, e.g. `/api/mappe/export?format=pdf`.
 * @param auth - The credential.
 * @param options - Method and JSON body; `accept` names the file's media type (any by default).
 * @returns The file and its suggested name, or the status and error body; never throws and never caches.
 */
export async function apiFileRequest(
  path: string,
  auth: ApiAuth,
  options: ApiRequestOptions & { readonly accept?: string } = {},
): Promise<ApiFileResult> {
  const response = await send(path, auth, options, options.accept ?? '*/*');
  if (!response) return { ok: false, status: 0 };
  if (!response.ok) return refusal(response.status, await readBody(response));
  try {
    const blob = await response.blob();
    const mediaType = response.headers.get('content-type') ?? blob.type;
    const filename = filenameFromDisposition(response.headers.get('content-disposition'));
    return { ok: true, status: response.status, blob, mediaType, ...(filename ? { filename } : {}) };
  } catch {
    return { ok: false, status: 0 };
  }
}
