/**
 * canvasRequests — the raw requests the live-contract checks send to a Canvas: a client-credentials token request,
 * and bearer-token reads and posts to its AGS and NRPS services, each answered as status, media type, next link and
 * JSON body.
 *
 * Why: the grade worker's own clients (`AgsAccessTokens`, `AgsScoreClient`) turn every answer into an outcome and
 *      cancel its body, which is right in production but hides what a check compares: the exact status, the OAuth
 *      error code, the media type and the paging links (D-101's amendment of 2026-11-05). These requests are sent as
 *      those clients send them: the same form fields, scopes and media types, no redirect followed, a time limit.
 * Spec: LTI-012, LTI-008
 * Invariants:
 *   - SECURITY: a redirect is never followed, and a bearer token goes only to the course's API origin
 *     (`LIVE_CANVAS_API_ORIGIN`, or the mock's): a URL taken from an answer (a line item's `id`, a `Link: next`) on
 *     another origin is refused before anything is sent, as the server checks a launch's service URLs (D-104). So
 *     neither an assertion nor a token goes to another host; neither is ever part of an answer, a log line or an
 *     error message (DATA-009).
 *   - A body is kept only when it parses as JSON; nothing here prints it.
 *   - Every request ends after `REQUEST_TIMEOUT_MS`.
 * Collaborators: ./canvasTarget.ts, ../src/grades/agsVocabulary.ts, the `*.live.test.ts` files.
 * Tests: apps/server/live/canvasRequests.test.ts, apps/server/live/canvasToken.live.test.ts,
 *   apps/server/live/canvasAgs.live.test.ts, apps/server/live/canvasNrps.live.test.ts
 */
import { JWT_BEARER_ASSERTION } from '../src/grades/agsVocabulary.js';
import type { CanvasTarget } from './canvasTarget.js';

/** How long one request to Canvas may take. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** What a check reads of an answer. */
export interface ServiceAnswer {
  readonly status: number;
  /** The `Content-Type` without parameters, in lower case; '' when there is none. */
  readonly mediaType: string;
  /** The `rel="next"` URL of the `Link` header, if any. */
  readonly next: string | undefined;
  /** The body, when it was JSON. */
  readonly json: unknown;
}

/**
 * Finds the `rel="next"` URL in a `Link` header, as Canvas pages its APIs.
 * @param header - The header, or null.
 * @returns The URL, or undefined when there is no next page.
 * @example
 * nextLinkOf('<https://c/x?page=2>; rel="next",<https://c/x?page=1>; rel="first"'); // 'https://c/x?page=2'
 */
export function nextLinkOf(header: string | null): string | undefined {
  for (const match of (header ?? '').matchAll(/<([^>]+)>\s*;\s*rel="?([^",;]+)"?/g)) {
    if (match[2]?.trim() === 'next') return match[1];
  }
  return undefined;
}

async function answerOf(response: Response): Promise<ServiceAnswer> {
  const text = await response.text().catch(() => '');
  let json: unknown;
  try {
    json = text === '' ? undefined : JSON.parse(text);
  } catch {
    json = undefined;
  }
  const mediaType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return { status: response.status, mediaType, next: nextLinkOf(response.headers.get('link')), json };
}

/**
 * Asks the platform's token endpoint for a client-credentials token, as `AgsAccessTokens` asks.
 * @param target - The Canvas and the tool's registration on it.
 * @param options - The scopes (space-separated) and, to see a refusal, another assertion audience.
 * @returns The answer; its JSON holds the token on success, so callers never print it.
 */
export async function requestToken(
  target: CanvasTarget,
  options: { readonly scope: string; readonly audience?: string },
): Promise<ServiceAnswer> {
  const response = await fetch(target.platform.accessTokenEndpoint, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: JWT_BEARER_ASSERTION,
      client_assertion: target.assertion(options.audience),
      scope: options.scope,
    }),
    // SECURITY: a redirect would carry the signed assertion to whatever host it names.
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return answerOf(response);
}

/**
 * Gets a token for the scopes, or fails the check that needs it.
 * @param target - The Canvas.
 * @param scope - The scopes, space-separated.
 * @returns The access token.
 * @throws Error naming the platform and the status, never the token, when none was granted.
 */
export async function accessToken(target: CanvasTarget, scope: string): Promise<string> {
  const answer = await requestToken(target, { scope });
  const token = (answer.json as { access_token?: unknown } | undefined)?.access_token;
  if (answer.status !== 200 || typeof token !== 'string') {
    throw new Error(`${target.description} granted no token for "${scope}" (HTTP ${answer.status})`);
  }
  return token;
}

/**
 * Refuses a URL that is not on the course's API origin, before a token is sent to it.
 * @param target - The Canvas; its `apiOrigin` is the only origin a bearer token goes to.
 * @param url - A service URL, often one taken from Canvas's own answer.
 * @returns The URL, unchanged.
 * @throws Error naming the variable, never the URL, when the URL is on another origin or is no URL.
 */
export function onApiOrigin(target: Pick<CanvasTarget, 'apiOrigin'>, url: string): string {
  let origin: string | undefined;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = undefined;
  }
  // SECURITY: a line item's `id` or a next link names its own host; the token must not follow it elsewhere.
  if (origin !== target.apiOrigin) {
    throw new Error('a service URL is not on LIVE_CANVAS_API_ORIGIN; no token was sent to it');
  }
  return url;
}

/**
 * Sends one bearer-token request to an AGS or NRPS URL on the course's API origin.
 * @param target - The Canvas; the URL must be on its `apiOrigin` (`onApiOrigin`).
 * @param url - The service URL.
 * @param token - The access token.
 * @param options - The media type to accept, and for a post its body and media type.
 * @returns The answer.
 * @throws Error from `onApiOrigin` for a URL on another origin.
 */
export async function serviceRequest(
  target: CanvasTarget,
  url: string,
  token: string,
  options: { readonly accept: string; readonly post?: { readonly body: object; readonly mediaType: string } },
): Promise<ServiceAnswer> {
  onApiOrigin(target, url);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: options.accept };
  if (options.post) headers['Content-Type'] = options.post.mediaType;
  const response = await fetch(url, {
    method: options.post ? 'POST' : 'GET',
    headers,
    ...(options.post && { body: JSON.stringify(options.post.body) }),
    // SECURITY: a redirect would carry the bearer token to whatever host it names.
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return answerOf(response);
}
