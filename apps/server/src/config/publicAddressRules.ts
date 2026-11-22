/**
 * publicAddressRules — the rules that hold in every mode when the server's public address is not a local one.
 *
 * Why: the production checks depend on `NODE_ENV`, which an installation can set wrongly. A server that others
 *      can reach must never run on the published example keys or on plain http, whatever its mode says, so the
 *      key rules and the https rules follow the address as well (D-133). A local address (the developer's own
 *      machine, CI and the tests) keeps the example keys and the http mocks.
 * Spec: DOC-008, DATA-002, AUTH-001, LTI-001
 * Invariants:
 *   - Local means: `localhost`, a name under `.localhost`, an IPv4 address in 127.0.0.0/8, or `[::1]`. Every
 *     other host is public, also a private network address: other machines reach it.
 *   - For a public address: the key rules (./keyStrengthRules.ts) and the https rules (./httpsRules.ts), and
 *     https for a set `FILES_BASE_URL`. Production applies them through ./productionChecks.ts instead, so nothing
 *     is reported twice.
 *   - Messages name the variable and the rule, never a secret or a URL.
 * Collaborators: ./env.ts (calls it when NODE_ENV is not `production`), ./keyStrengthRules.ts, ./httpsRules.ts.
 * Tests: apps/server/test/config/publicAddressRules.test.ts
 */
import { isIPv4 } from 'node:net';
import type { Env } from './env.js';
import { httpsProblems, isHttps, type HttpsCheckedEnv } from './httpsRules.js';
import { ringKeyProblems, weakPseudonymSecretProblems, type KeyCheckedEnv } from './keyStrengthRules.js';

/** The variables the rules read. */
export type PublicAddressCheckedEnv = KeyCheckedEnv & HttpsCheckedEnv & Pick<Env, 'FILES_BASE_URL'>;

const WHERE = 'when PUBLIC_BASE_URL is not a local address';

/**
 * Tells whether the server's public address is a local one.
 * @param publicBaseUrl - `PUBLIC_BASE_URL`, an absolute URL.
 * @returns True for `localhost`, a `.localhost` name, 127.0.0.0/8 and `[::1]`.
 */
export function isLocalAddress(publicBaseUrl: string): boolean {
  // WHY: `URL` lower-cases the host and writes every IPv4 spelling (decimal, hexadecimal) in dotted form.
  const host = new URL(publicBaseUrl).hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]') return true;
  return isIPv4(host) && host.startsWith('127.');
}

/**
 * Lists the problems of a configuration whose public address is not local; none for a local address.
 * @param env - Parsed configuration.
 * @returns One message per problem, in the `VARIABLE: reason` form of InvalidEnvironmentError.
 */
export function publicAddressProblems(env: PublicAddressCheckedEnv): string[] {
  if (isLocalAddress(env.PUBLIC_BASE_URL)) return [];
  // SECURITY: the example keys are published; on an address others can reach they protect nothing (D-133).
  const keys = [...weakPseudonymSecretProblems(env), ...ringKeyProblems(env)];
  return [
    ...keys.map((problem) => `${problem} (PUBLIC_BASE_URL is not a local address)`),
    ...httpsProblems(env, WHERE),
    ...(env.FILES_BASE_URL && !isHttps(env.FILES_BASE_URL)
      ? [`FILES_BASE_URL: must use https ${WHERE}`]
      : []),
  ];
}
