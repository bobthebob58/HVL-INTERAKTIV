/**
 * failureAuditBudget — how many rows failed logins and failed launches may add to the authentication audit in a
 * minute: a few per network address, and a ceiling for all addresses together.
 *
 * Why: a failed Feide login and a failed LTI launch are audited (D-064), and both can be caused by anyone, before
 *      any sign-in: a request with made-up values is enough. Each wrote one row, so whoever sent requests chose
 *      how fast the audit table grew, and the rows that matter drowned among them. A few rows a minute tell the
 *      same story: that failures come from an address, of which kind, and when (D-141).
 * Spec: DATA-007, LTI-001, AUTH-001
 * Invariants:
 *   - Only events that end in `.failed` are counted; every other event is always recorded.
 *   - At most `perAddress` rows a minute for one address and `overall` rows a minute for all addresses, in fixed
 *     windows counted in Redis, so every server node shares them.
 *   - PRIVACY: the address is counted under its keyed fingerprint, the value the audit row itself stores
 *     (`auth-audit-ip`); the key expires with its minute.
 *   - Redis unreachable: the row is written. The audit is worth more than its bound.
 * Collaborators: ./AuthAuditRecorder.ts (asks before it writes a failure's row),
 *   ../../learningDesign/collaboration/PersonRateLimit.ts (the counter), ../../server/createApp.ts (builds it).
 * Tests: apps/server/test/auth/audit/failureAuditBudget.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit } from '../../learningDesign/collaboration/PersonRateLimit.js';

/** Audit rows one address's failures may add in a minute. */
export const FAILURE_ROWS_PER_ADDRESS = 10;
/** Audit rows all failures together may add in a minute. */
export const FAILURE_ROWS_PER_MINUTE = 300;

const WINDOW_SECONDS = 60;

/** Decides whether a failure's audit row is written. */
export interface FailureAuditBudget {
  /**
   * Counts one failure of an address.
   * @param addressFingerprint - The keyed hash of the client address, or undefined when the event has none.
   * @returns True when its row may be written; false when the minute's rows are used up.
   */
  take(addressFingerprint: string | undefined): Promise<boolean>;
}

/**
 * Tells whether an audit event is a failure that the budget counts.
 * @param event - The event name.
 * @returns True for `login.feide.failed` and `launch.lti.failed`.
 */
export const isFailureEvent = (event: string): boolean => event.endsWith('.failed');

/**
 * Builds the budget on the server's Redis.
 * @param redis - The server's Redis client (not owned: the server closes it).
 * @param limits - The two numbers; D-141's outside tests.
 * @param keyPrefix - The counters' key prefix; a test names its own, so parallel tests do not share a count.
 * @returns The budget.
 * @spec DATA-007
 */
export function failureAuditBudget(
  redis: Redis,
  limits: { readonly perAddress: number; readonly overall: number } = {
    perAddress: FAILURE_ROWS_PER_ADDRESS,
    overall: FAILURE_ROWS_PER_MINUTE,
  },
  keyPrefix = 'hvli:audit-failures',
): FailureAuditBudget {
  const window = (prefix: string, limit: number) =>
    new PersonRateLimit(redis, { keyPrefix: prefix, limit, windowSeconds: WINDOW_SECONDS });
  const perAddress = window(`${keyPrefix}:`, limits.perAddress);
  const overall = window(`${keyPrefix}-all:`, limits.overall);
  return {
    take: async (addressFingerprint) => {
      try {
        // WHY: the address first, so one address past its own rows does not use up the rows of all the others.
        if (!(await perAddress.take(addressFingerprint ?? 'no-address')).allowed) return false;
        return (await overall.take('all')).allowed;
      } catch {
        return true;
      }
    },
  };
}
