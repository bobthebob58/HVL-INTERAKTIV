/**
 * productionChecks — extra configuration rules that apply only when NODE_ENV is `production`.
 *
 * Why: development and CI use published example secrets, plain-http mock services, may lack next year's
 *      secret and run the web app's development server. In production each of these breaks a guarantee: a
 *      published secret lets anyone recompute a learnerKey or forge a signed URL (DATA-002, D-058), a missing
 *      current-year secret fails every learner request, an http issuer or platform lets a network attacker forge
 *      logins (AUTH-001, LTI-001), the development server relaxes the web pages' policy (D-070), and Chromium
 *      without its sandbox would run a portfolio render with the server's own rights (D-096).
 * Spec: DATA-002, DOC-008, AUTH-001, LTI-001, LTI-002, DATA-011, MAPPE-004
 * Invariants:
 *   - Production needs a pseudonym secret for the current academic year (1 August boundary, Oslo time).
 *   - Production rejects secrets and ring keys that decode to text (printable ASCII plus tab, CR and LF), as
 *     every example does; 32 random bytes are text with a probability below 10^-13.
 *   - Production rejects secrets and ring keys with fewer than 16 distinct byte values (all zeros, the test
 *     fixtures); 32 random bytes have about 30.
 *   - Production rejects a key used in two places (two rings, or a ring and the pseudonym secrets), so one
 *     leaked purpose never exposes another (D-055, D-056, D-058).
 *   - Production requires https for the public base URL, Feide, the Groups API, Canvas origins and every
 *     configured LTI platform URL.
 *   - Production refuses `WEB_APP=dev`: Next.js's development server compiles on demand, shows stack traces and
 *     gets `'unsafe-eval'` and inline styles in its policy (../web/webPageCsp.ts). `prod` and `off` pass.
 *   - Production refuses `PDF_ALLOW_NO_SANDBOX=true`: the PDF export keeps Chromium's sandbox (D-096 amendment).
 *   - Messages name the variable, the year or the key ID, never a secret.
 * Collaborators: ./env.ts (calls it after parsing), ../privacy/academicYear.ts, ../security/keys/keyring.ts.
 * Tests: apps/server/test/config/env.test.ts, apps/server/test/config/productionChecks.test.ts
 */
import { academicYearOf } from '../privacy/academicYear.js';
import type { Keyring } from '../security/keys/keyring.js';
import type { Env } from './env.js';

// WHY: `echo … | base64` adds a newline, and a secret copied from a file may hold tabs or CR; all are text.
const isTextByte = (byte: number): boolean =>
  (byte >= 0x20 && byte < 0x7f) || byte === 0x09 || byte === 0x0a || byte === 0x0d;

/** Fewest distinct byte values a production secret may have. */
export const MIN_DISTINCT_BYTES = 16;

const ADVICE = 'use `openssl rand -base64 32`';

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
>;

const RINGS = ['IDENTITY_HASH_KEYS', 'DATA_ENCRYPTION_KEYS', 'URL_SIGNING_KEYS'] as const;

/**
 * Says why a secret is weak, if it is.
 * @param secret - The decoded secret.
 * @returns `readable text`, `not random enough`, or undefined for a good secret.
 */
export function weakness(secret: Buffer): string | undefined {
  if ([...secret].every(isTextByte)) return 'readable text';
  if (new Set(secret).size < MIN_DISTINCT_BYTES) return 'not random enough';
  return undefined;
}

const pseudonymProblems = (env: ProductionCheckedEnv, now: Date): string[] => {
  const problems: string[] = [];
  const year = academicYearOf(now);
  if (!env.PSEUDONYM_SECRETS.has(year)) {
    problems.push(`PSEUDONYM_SECRETS: no secret for the current academic year ${year}/${year + 1}`);
  }
  for (const [secretYear, secret] of env.PSEUDONYM_SECRETS) {
    const reason = weakness(secret);
    if (reason) problems.push(`PSEUDONYM_SECRETS: the ${secretYear} secret is ${reason}; ${ADVICE}`);
  }
  return problems;
};

const ringProblems = (env: ProductionCheckedEnv): string[] => {
  const problems: string[] = [];
  const owners = new Map<string, string>();
  for (const [year, secret] of env.PSEUDONYM_SECRETS)
    owners.set(secret.toString('hex'), `PSEUDONYM_SECRETS ${year}`);
  for (const name of RINGS) {
    const ring: Keyring = env[name];
    for (const key of ring.keys) {
      const reason = weakness(key.secret);
      if (reason) problems.push(`${name}: key ${key.id} is ${reason}; ${ADVICE}`);
      const owner = owners.get(key.secret.toString('hex'));
      if (owner)
        problems.push(`${name}: key ${key.id} is also used in ${owner}; every place needs its own key`);
      owners.set(key.secret.toString('hex'), `${name} ${key.id}`);
    }
  }
  return problems;
};

const isHttps = (url: string): boolean => new URL(url).protocol === 'https:';

const httpsProblems = (env: ProductionCheckedEnv): string[] => {
  const urls: [string, string][] = [
    ['PUBLIC_BASE_URL', env.PUBLIC_BASE_URL],
    ['FEIDE_ISSUER', env.FEIDE_ISSUER],
    ['FEIDE_GROUPS_API_URL', env.FEIDE_GROUPS_API_URL],
    ...env.CANVAS_ORIGINS.map((origin, i): [string, string] => [`CANVAS_ORIGINS entry ${i + 1}`, origin]),
    ...env.LTI_PLATFORMS.flatMap((platform, i) =>
      (['issuer', 'authEndpoint', 'tokenEndpoint', 'jwksUrl'] as const).map((field): [string, string] => [
        `LTI_PLATFORMS platform ${i + 1} ${field}`,
        platform[field],
      ]),
    ),
  ];
  return urls.filter(([, url]) => !isHttps(url)).map(([name]) => `${name}: must use https in production`);
};

// SECURITY: `.env.example` ships `WEB_APP=dev`; a production .env copied from it must not start the dev server.
const webAppProblems = (env: ProductionCheckedEnv): string[] =>
  env.WEB_APP === 'dev'
    ? [
        'WEB_APP: dev runs the Next.js development server; use prod (after npm run build) or off in production',
      ]
    : [];

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
 * @returns One message per problem, in the `VARIABLE: reason` form of InvalidEnvironmentError.
 */
export function productionProblems(env: ProductionCheckedEnv, now: Date): string[] {
  return [
    ...pseudonymProblems(env, now),
    ...ringProblems(env),
    ...httpsProblems(env),
    ...webAppProblems(env),
    ...pdfProblems(env),
  ];
}
