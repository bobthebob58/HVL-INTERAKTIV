/**
 * productionChecks — extra configuration rules that apply only when NODE_ENV is `production`.
 *
 * Why: development and CI use published example secrets and may lack next year's secret. In production
 *      either mistake breaks pseudonymisation (DATA-002): a published secret lets anyone recompute a
 *      learnerKey from a known Feide ID, and a missing current-year secret fails every learner request.
 * Spec: DATA-002, DOC-008
 * Invariants:
 *   - Production needs a secret for the current academic year (1 August boundary, Oslo time).
 *   - Production rejects secrets that decode to text (printable ASCII plus tab, CR and LF), as every
 *     example does; 32 random bytes are text with a probability below 10^-13.
 *   - Production rejects secrets with fewer than 16 distinct byte values (all zeros, the test fixtures);
 *     32 random bytes have about 30.
 *   - Messages name the variable and the year, never a secret.
 * Collaborators: ./env.ts (calls it after parsing), ../privacy/academicYear.ts.
 * Tests: apps/server/test/config/env.test.ts
 */
import { academicYearOf } from '../privacy/academicYear.js';
import type { Env } from './env.js';

// WHY: `echo … | base64` adds a newline, and a secret copied from a file may hold tabs or CR; all are text.
const isTextByte = (byte: number): boolean =>
  (byte >= 0x20 && byte < 0x7f) || byte === 0x09 || byte === 0x0a || byte === 0x0d;

/** Fewest distinct byte values a production secret may have. */
export const MIN_DISTINCT_BYTES = 16;

/**
 * Lists production-only configuration problems.
 * @param env - Parsed configuration.
 * @param now - The current time.
 * @returns One message per problem, in the `VARIABLE: reason` form of InvalidEnvironmentError.
 */
export function productionProblems(env: Pick<Env, 'PSEUDONYM_SECRETS'>, now: Date): string[] {
  const problems: string[] = [];
  const year = academicYearOf(now);
  if (!env.PSEUDONYM_SECRETS.has(year)) {
    problems.push(`PSEUDONYM_SECRETS: no secret for the current academic year ${year}/${year + 1}`);
  }
  const advice = 'use `openssl rand -base64 32`';
  for (const [secretYear, secret] of env.PSEUDONYM_SECRETS) {
    if ([...secret].every(isTextByte)) {
      problems.push(`PSEUDONYM_SECRETS: the ${secretYear} secret is readable text; ${advice}`);
    } else if (new Set(secret).size < MIN_DISTINCT_BYTES) {
      problems.push(`PSEUDONYM_SECRETS: the ${secretYear} secret is not random enough; ${advice}`);
    }
  }
  return problems;
}
