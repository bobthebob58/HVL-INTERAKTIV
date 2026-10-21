/**
 * pseudonymSecrets — parses the per-academic-year HMAC secrets used to derive learner pseudonyms.
 *
 * Why: DATA-002 rotates the pseudonym secret every academic year and destroys it at the yearly purge,
 *      so one configuration value holds several secrets, each labelled with the year it belongs to.
 * Spec: DATA-002
 * Invariants:
 *   - Format: `2025=<base64>,2026=<base64>`; the year is the calendar year in which the academic year starts.
 *   - Each secret decodes to at least 32 bytes (the HMAC-SHA256 block-size guidance for keys).
 *   - Errors never echo the secret value.
 * Collaborators: ../config/env.ts (validates PSEUDONYM_SECRETS), ./deriveLearnerKey.ts.
 * Tests: apps/server/test/privacy/deriveLearnerKey.test.ts
 */

/** Secrets keyed by the starting year of the academic year, e.g. 2026 for 2026/27. */
export type PseudonymSecrets = ReadonlyMap<number, Buffer>;

/** Minimum decoded secret length in bytes. */
export const MIN_SECRET_BYTES = 32;

/**
 * Parses `PSEUDONYM_SECRETS`.
 * @param raw - Comma-separated `year=base64` pairs.
 * @returns The secrets by academic year.
 * @throws Error naming the faulty entry by position and year, never by value.
 */
export function parsePseudonymSecrets(raw: string): PseudonymSecrets {
  const secrets = new Map<number, Buffer>();
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .forEach((part, index) => {
      const match = /^(\d{4})=([A-Za-z0-9+/_-]+={0,2})$/.exec(part);
      if (!match) throw new Error(`entry ${index + 1} is not "YYYY=<base64>"`);
      const year = Number(match[1]);
      // SECURITY: the value is decoded but never included in any message.
      const secret = Buffer.from(match[2] ?? '', 'base64');
      if (secret.length < MIN_SECRET_BYTES) {
        throw new Error(`secret for ${year} is shorter than ${MIN_SECRET_BYTES} bytes`);
      }
      if (secrets.has(year)) throw new Error(`year ${year} is listed twice`);
      secrets.set(year, secret);
    });
  if (secrets.size === 0) throw new Error('no secrets given');
  return secrets;
}
