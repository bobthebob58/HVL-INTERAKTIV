/**
 * keyStrengthRules — the rules a secret or ring key must pass wherever real people can reach the server: not
 * readable text, enough distinct bytes, and never used in two places.
 *
 * Why: development and CI use published example secrets. With one of them a stranger can recompute a learnerKey,
 *      read what the server encrypted or forge a signed URL (DATA-002, D-055, D-056, D-058). The rules therefore
 *      hold in production (./productionChecks.ts) and, in any other mode, whenever the public address is not a
 *      local one (./publicAddressRules.ts, D-133).
 * Spec: DATA-002, LTI-002, DOC-008
 * Invariants:
 *   - A secret that decodes to text (printable ASCII plus tab, CR and LF) is refused, as every example does;
 *     32 random bytes are text with a probability below 10^-13.
 *   - A secret with fewer than 16 distinct byte values is refused (all zeros, the test fixtures); 32 random
 *     bytes have about 30.
 *   - A key used in two places (two rings, or a ring and the pseudonym secrets) is refused, so one leaked
 *     purpose never exposes another.
 *   - Messages name the variable and the year or the key ID, never a secret.
 * Collaborators: ./productionChecks.ts, ./publicAddressRules.ts, ../security/keys/keyring.ts.
 * Tests: apps/server/test/config/env.test.ts, apps/server/test/config/productionChecks.test.ts,
 *   apps/server/test/config/publicAddressRules.test.ts
 */
import type { Keyring } from '../security/keys/keyring.js';
import type { Env } from './env.js';

// WHY: `echo … | base64` adds a newline, and a secret copied from a file may hold tabs or CR; all are text.
const isTextByte = (byte: number): boolean =>
  (byte >= 0x20 && byte < 0x7f) || byte === 0x09 || byte === 0x0a || byte === 0x0d;

/** Fewest distinct byte values a secret may have where the key rules apply. */
export const MIN_DISTINCT_BYTES = 16;

const ADVICE = 'use `openssl rand -base64 32`';

/** The variables the key rules read. */
export type KeyCheckedEnv = Pick<
  Env,
  'PSEUDONYM_SECRETS' | 'IDENTITY_HASH_KEYS' | 'DATA_ENCRYPTION_KEYS' | 'URL_SIGNING_KEYS'
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

/**
 * Lists the pseudonym secrets that are weak.
 * @param env - Parsed configuration.
 * @returns One message per weak secret, naming its year.
 */
export function weakPseudonymSecretProblems(env: KeyCheckedEnv): string[] {
  const problems: string[] = [];
  for (const [year, secret] of env.PSEUDONYM_SECRETS) {
    const reason = weakness(secret);
    if (reason) problems.push(`PSEUDONYM_SECRETS: the ${year} secret is ${reason}; ${ADVICE}`);
  }
  return problems;
}

/**
 * Lists the ring keys that are weak or used in a second place.
 * @param env - Parsed configuration.
 * @returns One message per problem, naming the ring and the key ID.
 */
export function ringKeyProblems(env: KeyCheckedEnv): string[] {
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
}
