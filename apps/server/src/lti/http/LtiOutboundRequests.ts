/**
 * LtiOutboundRequests — the one way ltijs asks a platform for anything: its public key set, an access token and
 * the pages of a course's roster. Only the platform's own addresses, no redirects, a time limit and a size limit.
 *
 * Why: ltijs's own `FetchRequestHandler` calls `fetch` with its defaults: redirects are followed, there is no
 *      time limit and the whole answer is read into memory. A launch waits for the key set, so a slow answer held
 *      launches open; and a roster's «next page» link comes from the answer itself, so it could name any host,
 *      which then got the request and its bearer token (D-104 set the same rule for the first roster URL and for
 *      scores). ltijs takes its request handler as an option; this is ours (D-141).
 * Spec: LTI-001, LTI-008, NFR-006
 * Invariants:
 *   - SECURITY: a URL is requested only when it parses, is http(s) (https alone when `requireHttps`), holds no
 *     user name or password, and its origin is one of `origins`: the configured platforms' issuer, endpoints and
 *     key-set URL, and `CANVAS_ORIGINS`. Anything else is refused before any request is made.
 *   - `redirect: 'manual'`: a 3xx is a failed request with its status, never followed.
 *   - Each request ends after `timeoutMs`, and an answer larger than `maxBytes` is given up unread.
 *   - The contract is ltijs's `RequestHandler`: the same headers, bodies and parsing as its `FetchRequestHandler`,
 *     and its `HttpError` with the status for an answer that is not 2xx (../nrps/nrpsRosterRead.ts reads it).
 *   - PRIVACY: an error names the origin of the URL, never its path or query, and never the answer's body.
 * Collaborators: ../LtiProviderFactory.ts (hands it to the ltijs `Provider`), ltijs `OidcService`,
 *   `AccessTokenManager` and `NamesAndRolesService` (its callers), ../../grades/lineItemUrlPolicy.ts (`webOriginOf`).
 * Tests: apps/server/test/lti/http/LtiOutboundRequests.test.ts, apps/server/test/lti/unknownKeyFetch.int.test.ts,
 *   apps/server/test/lti/nrps/NrpsLearnerCounter.int.test.ts (the roster, read through it)
 */
import { HttpError, type RequestHandler, type RequestOptions, type RequestResponse } from 'ltijs';
import type { LtiPlatformConfig } from '../../config/envParsers.js';
import { webOriginOf } from '../../grades/lineItemUrlPolicy.js';

/** How long one request to a platform may take. */
export const LTI_REQUEST_TIMEOUT_MS = 10_000;
/** The largest answer read: a roster page of 50 members and a key set are a few kilobytes each. */
export const LTI_RESPONSE_MAX_BYTES = 4 * 1024 * 1024;

/** What bounds the requests. */
export interface LtiOutboundRules {
  /** The origins that may be asked (`allowedLtiOrigins`). */
  readonly origins: readonly string[];
  /** True in production: only https. */
  readonly requireHttps?: boolean;
  /** `LTI_REQUEST_TIMEOUT_MS` unless a test shortens it. */
  readonly timeoutMs?: number;
  /** `LTI_RESPONSE_MAX_BYTES` unless a test lowers it. */
  readonly maxBytes?: number;
  /** `fetch` unless a test replaces it. */
  readonly fetch?: typeof fetch;
}

/**
 * The origins ltijs may ask: every configured platform's own, and the Canvas origins.
 * @param platforms - `LTI_PLATFORMS`.
 * @param canvasOrigins - `CANVAS_ORIGINS`, which serve the roster.
 * @returns Each origin once.
 */
export function allowedLtiOrigins(
  platforms: readonly Pick<LtiPlatformConfig, 'issuer' | 'authEndpoint' | 'tokenEndpoint' | 'jwksUrl'>[],
  canvasOrigins: readonly string[],
): string[] {
  const urls = platforms.flatMap((p) => [p.issuer, p.authEndpoint, p.tokenEndpoint, p.jwksUrl]);
  const origins = [...urls, ...canvasOrigins].map(webOriginOf);
  return [...new Set(origins.filter((origin): origin is string => origin !== undefined))];
}

const refused = (why: string, url: string, status?: number): HttpError =>
  new HttpError({
    message: `LTI request refused: ${why}`,
    url: webOriginOf(url) ?? '',
    ...(status === undefined ? {} : { status }),
  });

/** ltijs's request handler, bounded. */
export class LtiOutboundRequests implements RequestHandler {
  private readonly permanentHeaders: Record<string, string> = {};

  /**
   * @param rules - The origins, the https rule and the limits.
   */
  constructor(private readonly rules: LtiOutboundRules) {}

  /** ltijs's GET, within the rules. */
  get = <T = unknown>(url: string, options?: RequestOptions): Promise<RequestResponse<T>> =>
    this.request<T>('GET', url, undefined, options);

  /** ltijs's POST, within the rules. */
  post = <T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<RequestResponse<T>> =>
    this.request<T>('POST', url, body, options);

  /** ltijs's PUT, within the rules. */
  put = <T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<RequestResponse<T>> =>
    this.request<T>('PUT', url, body, options);

  /** ltijs's DELETE, within the rules. */
  delete = <T = unknown>(url: string, options?: RequestOptions): Promise<RequestResponse<T>> =>
    this.request<T>('DELETE', url, undefined, options);

  /** Sets a header that every later request carries (ltijs's interface). */
  setPermanentHeader = (name: string, value: string): void => {
    this.permanentHeaders[name] = value;
  };

  /** Refuses a URL that is not one of the platforms' own. */
  private assertAllowed(url: string): void {
    if (!URL.canParse(url)) throw refused('not a URL', url);
    const parsed = new URL(url);
    const origin = webOriginOf(url);
    if (origin === undefined || (this.rules.requireHttps && parsed.protocol !== 'https:'))
      throw refused('scheme', url);
    if (parsed.username !== '' || parsed.password !== '') throw refused('credentials in the URL', url);
    // SECURITY: also what stops a roster's «next page» link from naming another host (D-141).
    if (!this.rules.origins.includes(origin)) throw refused('origin not allowed', url);
  }

  private headers(body: unknown, headers: RequestOptions['headers']): Record<string, string> {
    const mapped = { ...this.permanentHeaders };
    if (headers?.authorization !== undefined) mapped.Authorization = headers.authorization;
    if (headers?.accept !== undefined) mapped.Accept = headers.accept;
    if (headers?.contentType !== undefined) mapped['Content-Type'] = headers.contentType;
    // WHY: as ltijs does: a form body names its own type; anything else is sent as JSON.
    if (body !== undefined && !(body instanceof URLSearchParams) && !('Content-Type' in mapped))
      mapped['Content-Type'] = 'application/json';
    return mapped;
  }

  /** The answer's text, read up to the size limit. */
  private async text(response: Response, url: string): Promise<string> {
    const max = this.rules.maxBytes ?? LTI_RESPONSE_MAX_BYTES;
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of (response.body ?? []) as AsyncIterable<Uint8Array>) {
      bytes += chunk.byteLength;
      if (bytes > max) {
        // WHY: the rest is not read; `for await` cancels the stream when the loop is left by a throw.
        throw refused('answer too large', url);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  private async request<T>(
    method: string,
    url: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<RequestResponse<T>> {
    const query = options?.query?.toString() ?? '';
    const target = query === '' ? url : `${url}${url.includes('?') ? '&' : '?'}${query}`;
    this.assertAllowed(target);
    const response = await (this.rules.fetch ?? fetch)(target, {
      method,
      headers: this.headers(body, options?.headers),
      ...(body === undefined ? {} : { body: body instanceof URLSearchParams ? body : JSON.stringify(body) }),
      // SECURITY: a redirect would carry the bearer token to whatever host it names (as D-104 for scores).
      redirect: 'manual',
      signal: AbortSignal.timeout(this.rules.timeoutMs ?? LTI_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw refused(`status ${String(response.status)}`, target, response.status);
    }
    const text = await this.text(response, target);
    return { data: parseBody(text) as T, headers: Object.fromEntries(response.headers.entries()) };
  }
}

/** The answer as ltijs parses it: nothing for an empty body, JSON when it is JSON, else the text. */
function parseBody(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
