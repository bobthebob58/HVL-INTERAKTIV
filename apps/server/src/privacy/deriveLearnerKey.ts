/**
 * deriveLearnerKey — turns a raw learner identity into the pseudonym stored everywhere else.
 *
 * Why: learner data must be linkable within one academic year (resume state, insight, grades) but
 *      must not identify anyone. An HMAC with a per-year secret does both; destroying the year's
 *      secret at the purge makes any remaining row unlinkable (DATA-002, DATA-003).
 * Spec: DATA-002
 * Invariants:
 *   - `learnerKey = HMAC-SHA256(secret[academicYear], source)`, base64url without padding (43 chars).
 *   - `source` is `feide|<feide-id>` or `lti|<iss>|<client-id>|<sub>`; the raw ID never leaves this function.
 *   - An LTI source names the platform registration (issuer and client ID), not the issuer alone: every hosted
 *     Canvas shares one issuer, so two registrations with one issuer are two namespaces of `sub` (D-129).
 *   - No secret for the year → `MissingPseudonymSecretError`; there is no fallback secret.
 * Collaborators: ./academicYear.ts, ./pseudonymSecrets.ts; callers in auth (S3) and LTI launch (S3).
 * Tests: apps/server/test/privacy/deriveLearnerKey.test.ts
 */
import { createHmac } from 'node:crypto';
import { academicYearOf } from './academicYear.js';
import type { PseudonymSecrets } from './pseudonymSecrets.js';

/** The raw identity of a learner, as known only during one request. */
export type LearnerSource =
  { kind: 'feide'; feideId: string } | { kind: 'lti'; issuer: string; clientId: string; subject: string };

/** Thrown when no pseudonym secret is configured for the academic year in question. */
export class MissingPseudonymSecretError extends Error {
  /**
   * @param academicYear - The year that has no secret.
   */
  constructor(readonly academicYear: number) {
    super(
      `No pseudonym secret for academic year ${academicYear}/${academicYear + 1}; ` +
        `add "${academicYear}=<base64>" to PSEUDONYM_SECRETS.`,
    );
    this.name = 'MissingPseudonymSecretError';
  }
}

/**
 * Builds the HMAC input for a learner.
 * @param source - Feide or LTI identity.
 * @returns `feide|<id>` or `lti|<iss>|<client-id>|<sub>`.
 * @throws Error when a part is empty, or when the LTI issuer or client ID contains `|` (it would make inputs
 *   ambiguous).
 */
export function pseudonymSource(source: LearnerSource): string {
  if (source.kind === 'feide') {
    if (source.feideId === '') throw new Error('Feide ID is empty');
    return `feide|${source.feideId}`;
  }
  if (source.issuer === '' || source.clientId === '' || source.subject === '')
    throw new Error('LTI issuer, client ID and subject are required');
  // WHY: neither part before the `sub` may hold "|", so the text splits one way only, even if the sub has "|".
  if (source.issuer.includes('|') || source.clientId.includes('|'))
    throw new Error('LTI issuer and client ID must not contain "|"');
  // SECURITY: the registration is part of the text, so a second platform that sends the same `iss` can never
  // name a user of the first (D-129).
  return `lti|${source.issuer}|${source.clientId}|${source.subject}`;
}

/**
 * Derives the learner pseudonym for the academic year that contains `at`.
 * @param source - Feide or LTI identity of the learner.
 * @param secrets - Per-year secrets from PSEUDONYM_SECRETS.
 * @param at - The moment of the event; defaults to now.
 * @returns The 43-character base64url `learnerKey`.
 * @throws MissingPseudonymSecretError when the year has no secret.
 */
export function deriveLearnerKey(
  source: LearnerSource,
  secrets: PseudonymSecrets,
  at: Date = new Date(),
): string {
  const year = academicYearOf(at);
  const secret = secrets.get(year);
  if (!secret) throw new MissingPseudonymSecretError(year);
  return createHmac('sha256', secret).update(pseudonymSource(source), 'utf8').digest('base64url');
}
