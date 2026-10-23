/**
 * fakeFetch — a stand-in for the browser's `fetch` that answers by method and path, and records every request.
 *
 * Why: component tests check what the web app sends to the Express API (method, path, credential headers, body) and
 *      how it shows each answer, without a server. Unknown requests answer 404, so a missing route fails loudly.
 * Spec: NFR-004
 * Tests: used by apps/web/test/components/*.test.tsx and apps/web/test/features/*.test.tsx.
 */
import { vi } from 'vitest';

/** One recorded request. */
export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly credentials: RequestCredentials | undefined;
}

/** An answer: status and JSON body (no body for 204). */
export interface FakeAnswer {
  readonly status: number;
  readonly body?: unknown;
}

/** Answers keyed by `METHOD /path`; a function answers each call afresh. */
export type FakeRoutes = Record<string, FakeAnswer | ((request: RecordedRequest) => FakeAnswer)>;

/**
 * Replaces `fetch` for the current test (restored by ./cleanup.ts).
 * @param routes - The answers.
 * @returns The recorded requests, in order.
 */
export function fakeFetch(routes: FakeRoutes): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal('fetch', async (path: string, init: RequestInit = {}) => {
    const request: RecordedRequest = {
      method: init.method ?? 'GET',
      path,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      credentials: init.credentials,
    };
    requests.push(request);
    const route = routes[`${request.method} ${path}`];
    const answer = typeof route === 'function' ? route(request) : (route ?? { status: 404, body: {} });
    const hasBody = answer.status !== 204 && answer.body !== undefined;
    return new Response(hasBody ? JSON.stringify(answer.body) : null, {
      status: answer.status,
      headers: hasBody ? { 'content-type': 'application/json' } : {},
    });
  });
  return requests;
}

/**
 * An API error body as the server sends it.
 * @param status - The HTTP status.
 * @param errorCode - The stable code, e.g. `hvl:content-changed`.
 * @param message - The translated message.
 * @returns The body.
 */
export const errorBody = (status: number, errorCode: string, message = errorCode) => ({
  success: false,
  errorCode,
  httpStatusCode: status,
  message,
});
