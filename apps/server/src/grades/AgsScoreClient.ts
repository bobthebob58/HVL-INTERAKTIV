/**
 * AgsScoreClient — posts one score to a Canvas line item with the worker's own client-credentials token, and says
 * what came of it.
 *
 * Why: SPEC-DEVIATION: D-104 — LTI-012 has a worker call ltijs's `context.grading.submitScore`, which works only from a
 *      live ltik; a durable worker holds none and must not store one (CLAUDE.md §1). This client sends LTI-012's score
 *      body itself, to the line item's URL with `/scores` added to its path, and turns the answer into D-104's
 *      outcomes. The worker depends on the `AgsScoreSender` interface, so tests and a later client can stand in.
 * Spec: LTI-012
 * Invariants:
 *   - The body is LTI-012's: `userId` (the learner's LTI `sub`), `scoreGiven`, `scoreMaximum: 100`,
 *     `activityProgress: 'Completed'`, `gradingProgress: 'FullyGraded'` and `timestamp` (the moment of sending),
 *     with the media type `application/vnd.ims.lis.v1.score+json`.
 *   - `/scores` goes onto the path and any query string of the line item stays, as ltijs's grading service does.
 *   - A 401 drops the cached token and tries once more with a new one; a second 401 fails the job (Canvas answers
 *     401 for a missing scope too, which no retry mends). A 404 is `orphaned` only when a `lineitem.readonly` read of
 *     the line item also answers 404 or 410.
 *   - SECURITY: redirects are never followed with the bearer token. PRIVACY: the `sub` and the token never reach a
 *     log or a reason (DATA-009).
 * Collaborators: ./AgsAccessTokens.ts, ./agsSendOutcome.ts, ./agsVocabulary.ts, ./gradeSyncRun.ts (the caller).
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts, apps/server/test/grades/gradeSyncFaults.int.test.ts
 */
import { networkOutcome, outcomeOfStatus, type AgsSendOutcome } from './agsSendOutcome.js';
import { AGS_REQUEST_TIMEOUT_MS, type AgsAccessTokens } from './AgsAccessTokens.js';
import { AGS_MEDIA_TYPES } from './agsVocabulary.js';

/** One score to send. */
export interface AgsScoreRequest {
  /** `LtiPlatform.id` of the placement. */
  readonly platformId: string;
  /** The placement's AGS line item URL. */
  readonly lineItemUrl: string;
  /** PRIVACY: the learner's LTI `sub`, decrypted for this request only (DATA-002). */
  readonly userId: string;
  /** The attempt policy's score, 0–100. */
  readonly scoreGiven: number;
  /** The moment of sending, the worker's tick (D-104). */
  readonly timestamp: Date;
}

/** Something that sends scores to a platform; the grade worker depends on this alone. */
export interface AgsScoreSender {
  /**
   * Sends one score.
   * @param request - Where, for whom and what.
   * @returns What came of it; never rejects for an HTTP or network failure.
   */
  postScore(request: AgsScoreRequest): Promise<AgsSendOutcome>;
}

/**
 * The URL of a line item's scores: `/scores` added to its path, its query string kept.
 * @param lineItemUrl - The line item's URL.
 * @returns The scores URL.
 */
export function scoresUrlOf(lineItemUrl: string): string {
  const url = new URL(lineItemUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/scores`;
  return url.toString();
}

/** Posts scores to AGS with the worker's own tokens (D-104). */
export class AgsScoreClient implements AgsScoreSender {
  private readonly fetch: typeof fetch;

  /**
   * @param tokens - The token source.
   * @param options - `fetch` (tests may pass a fake) and the time limit of one request (default 10 seconds).
   */
  constructor(
    private readonly tokens: AgsAccessTokens,
    private readonly options: { readonly fetch?: typeof fetch; readonly timeoutMs?: number } = {},
  ) {
    this.fetch = options.fetch ?? fetch;
  }

  /** {@inheritDoc AgsScoreSender.postScore} */
  async postScore(request: AgsScoreRequest): Promise<AgsSendOutcome> {
    const now = request.timestamp;
    let token = await this.tokens.token(request.platformId, now);
    if (token.kind !== 'token') return token;
    let response = await this.post(request, token.accessToken);
    if (response?.status === 401) {
      // WHY: an expired or revoked token and a missing scope both answer 401; one new token tells them apart.
      this.tokens.forget(request.platformId);
      token = await this.tokens.token(request.platformId, now);
      if (token.kind !== 'token') return token;
      response = await this.post(request, token.accessToken);
      if (response?.status === 401) return { kind: 'failed', reason: 'http-401' };
    }
    if (response === undefined) return networkOutcome();
    if (response.ok) return { kind: 'sent' };
    if (response.status === 404) return this.confirmGone(request.lineItemUrl, token.accessToken, now);
    return outcomeOfStatus(response.status, response.headers.get('retry-after'), now);
  }

  /** The score post; undefined when no answer came. */
  private async post(request: AgsScoreRequest, accessToken: string): Promise<Response | undefined> {
    const body = {
      userId: request.userId,
      scoreGiven: request.scoreGiven,
      scoreMaximum: 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: request.timestamp.toISOString(),
    };
    return this.send(scoresUrlOf(request.lineItemUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': AGS_MEDIA_TYPES.score },
      body: JSON.stringify(body),
    });
  }

  /** D-104's check that a 404 means a deleted line item: a `lineitem.readonly` read must answer 404 or 410. */
  private async confirmGone(lineItemUrl: string, accessToken: string, now: Date): Promise<AgsSendOutcome> {
    const read = await this.send(lineItemUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: AGS_MEDIA_TYPES.lineItem },
    });
    if (read === undefined) return networkOutcome();
    if (read.status === 404 || read.status === 410) return { kind: 'orphaned' };
    // WHY: the line item is there, so the 404 was about something else; with no rule for it, the job fails at once.
    if (read.ok) return { kind: 'failed', reason: 'http-404' };
    return outcomeOfStatus(read.status, read.headers.get('retry-after'), now, 'lineitem-');
  }

  private async send(url: string, init: RequestInit): Promise<Response | undefined> {
    try {
      // SECURITY: a redirect would carry the bearer token to whatever host it names; a 3xx fails the job instead.
      const response = await this.fetch(url, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.options.timeoutMs ?? AGS_REQUEST_TIMEOUT_MS),
      });
      // WHY: only the status and headers are read; an unread body would hold its connection open.
      await response.body?.cancel().catch(() => undefined);
      return response;
    } catch {
      return undefined;
    }
  }
}
