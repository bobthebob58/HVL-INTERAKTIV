/**
 * apiRequest — every request the web app makes to the Express API, from the browser, with the right credential.
 *
 * Why: Express removes cookies and tokens before Next.js renders a page (D-068), so pages fetch their data in the
 *      browser. Portal pages send the session cookie and, for PUT, POST and PATCH, the CSRF token from
 *      `GET /auth/session` (D-057); LTI pages send the ltik as `Authorization: Bearer` and no cookie (LTI-003).
 * Spec: AUTH-003, LTI-003, DOC-012
 * Invariants:
 *   - The ltik goes only into the Authorization header of same-origin requests, never into a URL here.
 *   - Requests are never cached (`no-store`), like every `/api` answer.
 *   - Never throws: a network failure is `{ ok: false, status: 0 }`.
 * Collaborators: ./contentApi.ts, ./meApi.ts, ./portalSession.ts, ./ApiAuthContext.tsx,
 *   packages/api-contract (`ErrorBody`, `CSRF_HEADER_NAME`).
 * Tests: apps/web/test/api/apiRequest.test.ts
 */
import type { ErrorBody } from '@hvl-interaktiv/api-contract';

/** The header that carries the CSRF token; the same name as api-contract's `CSRF_HEADER_NAME` (a test checks it). */
export const CSRF_HEADER = 'x-csrf-token';

/** How a request proves who sends it. */
export type ApiAuth =
  /** A Feide session: the cookie, plus the CSRF token for unsafe methods once it is known. */
  | { readonly kind: 'portal'; readonly csrfToken?: string }
  /** A Canvas launch: the ltik, kept in page memory only. */
  | { readonly kind: 'lti'; readonly ltik: string };

/** The methods the API uses. */
export type ApiMethod = 'GET' | 'PUT' | 'POST' | 'PATCH';

/** The outcome of a request: data, or the status and the server's error body. */
export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly error?: ErrorBody; readonly body?: unknown };

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
 * @returns The header map.
 */
export function apiHeaders(auth: ApiAuth, method: ApiMethod, json: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (json) headers['Content-Type'] = 'application/json';
  // SECURITY: the ltik is a bearer credential for the launch (LTI-003); it travels only in this header.
  if (auth.kind === 'lti') headers.Authorization = `Bearer ${auth.ltik}`;
  // SECURITY: the synchronizer token defeats cross-site requests that carry the session cookie (AUTH-003).
  if (auth.kind === 'portal' && method !== 'GET' && auth.csrfToken) headers[CSRF_HEADER] = auth.csrfToken;
  return headers;
}

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
  options: { readonly method?: ApiMethod; readonly body?: unknown } = {},
): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const json = options.body !== undefined;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: apiHeaders(auth, method, json),
      body: json ? JSON.stringify(options.body) : undefined,
      // PRIVACY: an LTI page sends no cookie, so the launch is the only principal (LTI-003).
      credentials: auth.kind === 'lti' ? 'omit' : 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0 };
  }
  const body = await readBody(response);
  if (response.ok) return { ok: true, status: response.status, data: body as T };
  return isErrorBody(body)
    ? { ok: false, status: response.status, error: body, body }
    : { ok: false, status: response.status, body };
}
