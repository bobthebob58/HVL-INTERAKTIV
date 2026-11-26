/**
 * httpsRules — the configured addresses that must use https wherever real people can reach the server.
 *
 * Why: over plain http a network attacker can forge a Feide login or an LTI launch, or read a session
 *      (AUTH-001, LTI-001). The rule holds in production (./productionChecks.ts) and, in any other mode, whenever
 *      the public address is not a local one (./publicAddressRules.ts, D-133); local mocks stay on http.
 * Spec: AUTH-001, LTI-001, DOC-008
 * Invariants:
 *   - Checked: the public base URL, Feide's issuer, the Groups API, every Canvas origin and every URL of every
 *     configured LTI platform.
 *   - Messages name the variable (and the entry or the platform's field), never a URL.
 * Collaborators: ./productionChecks.ts, ./publicAddressRules.ts, ./env.ts.
 * Tests: apps/server/test/config/productionChecks.test.ts, apps/server/test/config/publicAddressRules.test.ts
 */
import type { Env } from './env.js';

/** The variables the https rule reads. */
export type HttpsCheckedEnv = Pick<
  Env,
  'PUBLIC_BASE_URL' | 'FEIDE_ISSUER' | 'FEIDE_GROUPS_API_URL' | 'CANVAS_ORIGINS' | 'LTI_PLATFORMS'
>;

/**
 * Tells whether an address uses https.
 * @param url - An absolute URL.
 * @returns True for `https:`.
 */
export const isHttps = (url: string): boolean => new URL(url).protocol === 'https:';

/**
 * Lists the configured addresses that do not use https.
 * @param env - Parsed configuration.
 * @param where - When the rule applies, for the message: e.g. `in production`.
 * @returns One message per address, as `VARIABLE: must use https <where>`.
 */
export function httpsProblems(env: HttpsCheckedEnv, where: string): string[] {
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
  return urls.filter(([, url]) => !isHttps(url)).map(([name]) => `${name}: must use https ${where}`);
}
