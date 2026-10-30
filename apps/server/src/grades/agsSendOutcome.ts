/**
 * agsSendOutcome — what one attempt to send a score to Canvas came to, and how an HTTP status maps onto it.
 *
 * Why: D-104 fixes the outcomes: a 2xx succeeds; a deleted line item is `orphaned`; a 429, a 5xx or a network error is
 *      retried with backoff, honouring `Retry-After`; any other 4xx fails the job at once. Canvas answers 401 both for
 *      a bad or expired token and for a missing scope, so a 401 is decided by its status alone, never its body.
 * Spec: LTI-012
 * Invariants:
 *   - A reason is a short fixed code (`http-503`, `network`, `token-http-400`, …), never text from a response, so
 *     `GradeSyncJob.lastError` and the logs hold no personal data (DATA-009).
 *   - `Retry-After` is read as delta-seconds or an HTTP date; anything else is ignored, never trusted as a delay.
 * Collaborators: ./AgsScoreClient.ts, ./AgsAccessTokens.ts, ./gradeRetrySchedule.ts.
 * Tests: apps/server/test/grades/agsSendOutcome.test.ts
 */

/** How one send ended: sent, line item gone, worth retrying, or failed for good. */
export type AgsSendOutcome =
  | { readonly kind: 'sent' }
  | { readonly kind: 'orphaned' }
  | { readonly kind: 'retry'; readonly reason: string; readonly retryAfterMs?: number }
  | { readonly kind: 'failed'; readonly reason: string };

/** The outcome kinds that end a send before the score is accepted (everything but `sent`). */
export type AgsStopOutcome = Exclude<AgsSendOutcome, { kind: 'sent' }>;

const ONE_SECOND_MS = 1000;

/**
 * Reads a `Retry-After` header.
 * @param header - The header value, or null when absent.
 * @param now - The moment the answer came, for an HTTP date.
 * @returns The delay in milliseconds (0 for a date in the past), or undefined when absent or unreadable.
 */
export function retryAfterMs(header: string | null, now: Date): number | undefined {
  if (header === null) return undefined;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value) * ONE_SECOND_MS;
  // WHY: only an IMF-fixdate (RFC 9110) names a weekday and GMT; a bare number of another shape is not a date.
  if (!/GMT$/.test(value)) return undefined;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now.getTime());
}

/**
 * Tells whether a status is worth another attempt later: 429 and every 5xx (D-104).
 * @param status - An HTTP status.
 * @returns True for 429 and 500–599.
 */
export const isRetryableStatus = (status: number): boolean =>
  status === 429 || (status >= 500 && status <= 599);

/**
 * The outcome of an answer that is neither a success nor handled specially (401 and 404 are, by the client).
 * @param status - The HTTP status, 300–599.
 * @param retryAfter - The answer's `Retry-After` header, or null.
 * @param now - The moment the answer came.
 * @param prefix - What was asked, put before the status in the reason: '' for a score, `token-` for a token.
 * @returns Retry (429, 5xx, with the header's delay when it gives one) or failed (anything else).
 */
export function outcomeOfStatus(
  status: number,
  retryAfter: string | null,
  now: Date,
  prefix = '',
): AgsStopOutcome {
  const reason = `${prefix}http-${status}`;
  if (!isRetryableStatus(status)) return { kind: 'failed', reason };
  const delay = retryAfterMs(retryAfter, now);
  return delay === undefined ? { kind: 'retry', reason } : { kind: 'retry', reason, retryAfterMs: delay };
}

/**
 * The outcome of a request that got no answer: refused, reset, or past its time limit.
 * @param prefix - What was asked: '' for a score, `token-` for a token.
 * @returns A retry: D-104 retries network errors like a 5xx.
 */
export const networkOutcome = (prefix = ''): AgsStopOutcome => ({
  kind: 'retry',
  reason: `${prefix}network`,
});
