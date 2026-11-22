/**
 * productionChecks — extra configuration rules that apply only when NODE_ENV is `production`.
 *
 * Why: development and CI use published example secrets, plain-http mock services, may lack next year's
 *      secret and run the web app's development server. In production each of these breaks a guarantee: a
 *      published secret lets anyone recompute a learnerKey or forge a signed URL (DATA-002, D-058), a missing
 *      current-year secret fails every learner request, an http issuer or platform lets a network attacker forge
 *      logins (AUTH-001, LTI-001), the development server relaxes the web pages' policy (D-070), Chromium
 *      without its sandbox would run a portfolio render with the server's own rights (D-096), and a clear-text
 *      connection or storage outside the EEA breaks DATA-004 (D-109).
 * Spec: DATA-002, DOC-008, AUTH-001, LTI-001, LTI-002, DATA-011, MAPPE-004, DATA-004
 * Invariants:
 *   - Production needs a pseudonym secret for the current academic year (1 August boundary, Oslo time).
 *   - Production applies the key rules (./keyStrengthRules.ts: no readable text, enough distinct bytes, no key
 *     used in two places) and the https rules (./httpsRules.ts: the public base URL, Feide, the Groups API, Canvas
 *     origins and every configured LTI platform URL). Both also hold outside production when the public address
 *     is not local (./publicAddressRules.ts, D-133).
 *   - Production refuses the debug switches `DEBUG` and `NODE_DEBUG` (./debugOutput.ts, D-133).
 *   - Production refuses `WEB_APP=dev`: Next.js's development server compiles on demand, shows stack traces and
 *     gets `'unsafe-eval'` and inline styles in its policy (../web/webPageCsp.ts). It refuses `WEB_APP=off` too:
 *     without the web app a Canvas launch lands on the player's own page, with no page of ours around the player
 *     (D-123, the owner's decision of 2026-11-21). Only `prod` passes; `off` and `dev` are for tests and development.
 *   - Production refuses `PDF_ALLOW_NO_SANDBOX=true`: the PDF export keeps Chromium's sandbox (D-096 amendment).
 *   - Production requires encrypted database, Redis and S3 connections (./connectionEncryption.ts) and file storage
 *     on the EEA list (./storageResidency.ts) (D-109 amendment of 2026-11-04), and refuses the AWS SDK's own endpoint
 *     variables, read from the raw environment, which would bypass both, and a bucket variable that is an ARN rather
 *     than a plain bucket name (D-109 amendments of 2026-11-05).
 *   - Messages name the variable, the year, the key ID, or a storage region or host, never a secret or a URL.
 * Collaborators: ./env.ts (calls it after parsing), ../privacy/academicYear.ts, ./keyStrengthRules.ts,
 *   ./httpsRules.ts, ./debugOutput.ts, ./connectionEncryption.ts, ./storageResidency.ts.
 * Tests: apps/server/test/config/env.test.ts, apps/server/test/config/productionChecks.test.ts,
 *   apps/server/test/config/connectionEncryption.test.ts, apps/server/test/config/storageResidency.test.ts
 */
import { academicYearOf } from '../privacy/academicYear.js';
import { connectionEncryptionProblems } from './connectionEncryption.js';
import { debugOutputProblems } from './debugOutput.js';
import type { Env } from './env.js';
import { httpsProblems } from './httpsRules.js';
import { ringKeyProblems, weakPseudonymSecretProblems } from './keyStrengthRules.js';
import { bucketNameProblems, sdkEndpointProblems, storageResidencyProblems } from './storageResidency.js';

/** The variables production checks read. */
export type ProductionCheckedEnv = Pick<
  Env,
  | 'PSEUDONYM_SECRETS'
  | 'IDENTITY_HASH_KEYS'
  | 'DATA_ENCRYPTION_KEYS'
  | 'URL_SIGNING_KEYS'
  | 'PUBLIC_BASE_URL'
  | 'FEIDE_ISSUER'
  | 'FEIDE_GROUPS_API_URL'
  | 'CANVAS_ORIGINS'
  | 'LTI_PLATFORMS'
  | 'WEB_APP'
  | 'PDF_ALLOW_NO_SANDBOX'
  | 'DATABASE_URL'
  | 'REDIS_URL'
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_CONTENT_BUCKET'
  | 'S3_TEMPORARY_BUCKET'
>;

const pseudonymProblems = (env: ProductionCheckedEnv, now: Date): string[] => {
  const year = academicYearOf(now);
  const missing = env.PSEUDONYM_SECRETS.has(year)
    ? []
    : [`PSEUDONYM_SECRETS: no secret for the current academic year ${year}/${year + 1}`];
  return [...missing, ...weakPseudonymSecretProblems(env)];
};

// SECURITY: `.env.example` ships `WEB_APP=dev`; a production .env copied from it must not start the dev server.
// SECURITY: `off` is the default; production must name `prod`, so the player is always inside the web app's page.
const WEB_APP_PROBLEMS: Readonly<Record<string, string>> = {
  dev: 'WEB_APP: dev runs the Next.js development server; use prod (after npm run build) in production',
  off: 'WEB_APP: off serves the player without the web app around it; use prod (after npm run build) in production',
};
const webAppProblems = (env: ProductionCheckedEnv): string[] => {
  const problem = WEB_APP_PROBLEMS[env.WEB_APP];
  return problem === undefined ? [] : [problem];
};

// SECURITY: Chromium renders text authors wrote; its sandbox confines an exploit in the renderer, so production never
// turns it off. Development containers run as root, where Chromium refuses its sandbox (D-096 amendment).
const pdfProblems = (env: ProductionCheckedEnv): string[] =>
  env.PDF_ALLOW_NO_SANDBOX
    ? [
        "PDF_ALLOW_NO_SANDBOX: production keeps Chromium's sandbox for the PDF export; run the server as a " +
          'non-root user instead (D-096)',
      ]
    : [];

/**
 * Lists production-only configuration problems.
 * @param env - Parsed configuration.
 * @param now - The current time.
 * @param source - The raw environment, for variables the parsed configuration drops (the AWS SDK's own ones).
 * @returns One message per problem, in the `VARIABLE: reason` form of InvalidEnvironmentError.
 */
export function productionProblems(
  env: ProductionCheckedEnv,
  now: Date,
  source: NodeJS.ProcessEnv = {},
): string[] {
  return [
    ...pseudonymProblems(env, now),
    ...ringKeyProblems(env),
    ...httpsProblems(env, 'in production'),
    ...webAppProblems(env),
    ...pdfProblems(env),
    ...connectionEncryptionProblems(env),
    ...storageResidencyProblems(env),
    ...bucketNameProblems(env),
    ...sdkEndpointProblems(source),
    ...debugOutputProblems(source),
  ];
}
