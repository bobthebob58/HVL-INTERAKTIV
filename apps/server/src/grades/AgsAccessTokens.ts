/**
 * AgsAccessTokens — gets and caches the client-credentials token the grade worker sends scores with, per platform.
 *
 * Why: D-104's worker holds no ltik, so it requests the token itself: a client assertion signed with the tool key
 *      ltijs stores for the platform (read through ltijs's `platformManager`, decrypted by our
 *      `PrismaLtiDatabaseManager`, D-056), posted to the platform's token endpoint with LTI-012's two scopes. A token
 *      is reused until shortly before it expires, as ltijs's own token manager does.
 * Spec: LTI-012
 * Invariants:
 *   - One cached token per platform (the scopes are fixed), dropped 60 seconds before `expires_in` ends on the wall
 *     clock, or at once by `forget` after a 401.
 *   - An unknown or deactivated platform fails at once (`platform-unavailable`); a key that cannot sign fails at
 *     once (`platform-key`); a 429, a 5xx or no answer is retried; any other answer fails (`token-http-<status>`).
 *   - SECURITY: redirects are never followed, so neither the assertion nor a token goes to another host; the token,
 *     the assertion and the key are never logged, stored or put into a reason.
 * Collaborators: ./agsClientAssertion.ts, ./agsSendOutcome.ts, ./agsVocabulary.ts, ./AgsScoreClient.ts,
 *   ltijs's `Provider.platformManager`.
 * Tests: apps/server/test/grades/AgsAccessTokens.test.ts, apps/server/test/grades/gradeSyncWorker.int.test.ts
 */
import { z } from 'zod';
import { signClientAssertion, type AssertionPlatform } from './agsClientAssertion.js';
import { networkOutcome, outcomeOfStatus, type AgsStopOutcome } from './agsSendOutcome.js';
import { AGS_TOKEN_SCOPE, JWT_BEARER_ASSERTION } from './agsVocabulary.js';

/** A platform as ltijs's platform manager returns it, reduced to what a token request needs. */
export interface AgsPlatformRecord extends AssertionPlatform {
  /** False for a platform removed from `LTI_PLATFORMS` (D-051). */
  readonly active: boolean;
}

/** The part of ltijs's `PlatformManager` the token source reads; `Provider.platformManager` satisfies it. */
export interface AgsPlatformDirectory {
  /**
   * Finds a registered platform.
   * @param platformId - `LtiPlatform.id`.
   * @returns The platform, or undefined when none has that ID.
   */
  getPlatformById(platformId: string): Promise<AgsPlatformRecord | undefined>;
  /**
   * The tool's private key for a platform, decrypted (D-056).
   * @param platform - A platform from `getPlatformById`.
   * @returns The key as PEM.
   */
  getPrivateKey(platform: AgsPlatformRecord): Promise<string>;
}

/** What the token source needs. */
export interface AgsAccessTokensDeps {
  readonly platforms: AgsPlatformDirectory;
  /** `fetch`; tests may pass a fake. */
  readonly fetch?: typeof fetch;
  /** The wall clock in milliseconds, for the assertion's `iat` and the token's expiry; tests may pass one. */
  readonly wallClock?: () => number;
  /** How long one token request may take; default 10 seconds. */
  readonly timeoutMs?: number;
}

/** A token, or why there is none. */
export type AgsTokenOutcome = { readonly kind: 'token'; readonly accessToken: string } | AgsStopOutcome;

/** How long before its expiry a cached token is no longer used, as ltijs's token manager does. */
export const TOKEN_EXPIRY_MARGIN_MS = 60_000;
/** The default time limit of one request to a platform. */
export const AGS_REQUEST_TIMEOUT_MS = 10_000;
/** The lifetime assumed when a token answer gives none (Canvas gives 3600 seconds). */
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

const tokenAnswer = z.object({
  access_token: z.string().min(1),
  token_type: z.string().regex(/^bearer$/i),
  expires_in: z.number().positive().optional(),
});

/** Client-credentials tokens for AGS, cached per platform. */
export class AgsAccessTokens {
  private readonly cache = new Map<string, { readonly accessToken: string; readonly expiresAtMs: number }>();
  private readonly fetch: typeof fetch;
  private readonly wallClock: () => number;

  /**
   * @param deps - The platform directory, and optionally `fetch`, a wall clock and a time limit.
   */
  constructor(private readonly deps: AgsAccessTokensDeps) {
    this.fetch = deps.fetch ?? fetch;
    this.wallClock = deps.wallClock ?? Date.now;
  }

  /**
   * A token for the platform: the cached one while it is valid, else a new one.
   * @param platformId - `LtiPlatform.id`.
   * @param now - The worker's moment, for an HTTP-date `Retry-After`.
   * @returns The token, or the outcome that stops this send.
   * @spec LTI-012
   */
  async token(platformId: string, now: Date): Promise<AgsTokenOutcome> {
    const cached = this.cache.get(platformId);
    if (cached && cached.expiresAtMs - TOKEN_EXPIRY_MARGIN_MS > this.wallClock()) {
      return { kind: 'token', accessToken: cached.accessToken };
    }
    return this.request(platformId, now);
  }

  /**
   * Drops a platform's cached token, after the platform refused it (401).
   * @param platformId - `LtiPlatform.id`.
   */
  forget(platformId: string): void {
    this.cache.delete(platformId);
  }

  private async assertionFor(
    platformId: string,
  ): Promise<{ platform: AgsPlatformRecord; assertion: string } | AgsStopOutcome> {
    let platform: AgsPlatformRecord | undefined;
    let key: string;
    try {
      platform = await this.deps.platforms.getPlatformById(platformId);
      if (!platform?.active) return { kind: 'failed', reason: 'platform-unavailable' };
      key = await this.deps.platforms.getPrivateKey(platform);
    } catch {
      // WHY: a storage error may pass (the database restarts); it is retried and counted like a 5xx.
      return { kind: 'retry', reason: 'platform-lookup' };
    }
    try {
      return { platform, assertion: signClientAssertion(platform, key, this.wallClock()) };
    } catch {
      return { kind: 'failed', reason: 'platform-key' };
    }
  }

  private async request(platformId: string, now: Date): Promise<AgsTokenOutcome> {
    const signed = await this.assertionFor(platformId);
    if ('kind' in signed) return signed;
    const requestedAt = this.wallClock();
    let response: Response;
    try {
      response = await this.fetch(signed.platform.accessTokenEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_assertion_type: JWT_BEARER_ASSERTION,
          client_assertion: signed.assertion,
          scope: AGS_TOKEN_SCOPE,
        }),
        // SECURITY: a redirect would send the signed assertion to whatever host it names; a 3xx fails instead.
        redirect: 'manual',
        signal: AbortSignal.timeout(this.deps.timeoutMs ?? AGS_REQUEST_TIMEOUT_MS),
      });
    } catch {
      return networkOutcome('token-');
    }
    if (!response.ok)
      return outcomeOfStatus(response.status, response.headers.get('retry-after'), now, 'token-');
    const answer = tokenAnswer.safeParse(await response.json().catch(() => undefined));
    // WHY: a 2xx that is not a token (a proxy's page) is treated as passing, like a 5xx.
    if (!answer.success) return { kind: 'retry', reason: 'token-answer' };
    const lifetimeMs = (answer.data.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000;
    this.cache.set(platformId, {
      accessToken: answer.data.access_token,
      expiresAtMs: requestedAt + lifetimeMs,
    });
    return { kind: 'token', accessToken: answer.data.access_token };
  }
}
