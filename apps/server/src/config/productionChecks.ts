/**
 * productionChecks — extra configuration rules that apply only when NODE_ENV is `production`.
 *
 * Why: development and CI use published example secrets and may lack next year's secret. In production
 *      either mistake breaks pseudonymisation (DATA-002): a published secret lets anyone recompute a
 *      learnerKey from a known Feide ID, and a missing current-year secret fails every learner request.
 * Spec: DATA-002, DOC-008
 * Invariants:
 *   - Production needs a secret for the current academic year (1 August boundary, Oslo time).
 *   - Production rejects secrets that decode to printable text, as every example and CI secret does;
 *     32 random bytes are printable text with a probability of about 10^-14.
 *   - Messages name the variable and the year, never a secret.
 * Collaborators: ./env.ts (calls it after parsing), ../privacy/academicYear.ts.
 * Tests: apps/server/test/config/env.test.ts
 */
import { academicYearOf } from '../privacy/academicYear.js';
import type { Env } from './env.js';

const isPrintableText = (secret: Buffer): boolean => [...secret].every((byte) => byte >= 0x20 && byte < 0x7f);

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
  for (const [secretYear, secret] of env.PSEUDONYM_SECRETS) {
    if (isPrintableText(secret)) {
      problems.push(
        `PSEUDONYM_SECRETS: the ${secretYear} secret is readable text; use \`openssl rand -base64 32\``,
      );
    }
  }
  return problems;
}
