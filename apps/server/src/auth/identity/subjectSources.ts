/**
 * subjectSources — the one place that turns a Feide or LTI subject into the text that is hashed for an `Identity`
 * row and for the learnerKey.
 *
 * Why: `Identity.subjectHash` (D-055) and the learnerKey (DATA-002) are keyed hashes of the same subject. If the
 *      two were built from differently normalised text, one person would get two accounts, or a learnerKey that
 *      does not match their account. Both therefore come from one checked subject, in the DATA-002 format
 *      `feide|<feide-id>` / `lti|<iss>|<sub>` (pseudonymSource).
 * Spec: DATA-002, AUTH-001, LTI-001
 * Invariants:
 *   - A Feide subject is the normalised Feide ID (trimmed, lower-cased, FEIDE_ID_PATTERN, D-054); anything else
 *     throws, so no caller can hash a raw claim by mistake. `sub` from Feide is never a source.
 *   - An LTI subject is `(iss, sub)` exactly as the launch carried them (both case-sensitive); empty parts or an
 *     issuer containing `|` throw (pseudonymSource).
 *   - Errors never contain the subject.
 * Collaborators: ../../privacy/deriveLearnerKey.ts (pseudonymSource, deriveLearnerKey),
 *   ../../security/keys/IdentityHasher.ts, ./AccountResolver.ts, ./accountLinking.ts.
 * Tests: apps/server/test/auth/identity/subjectSources.test.ts
 */
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import { pseudonymSource, type LearnerSource } from '../../privacy/deriveLearnerKey.js';

/** Who logged in: a Feide ID (portal) or an LTI issuer and subject (Canvas). */
export type IdentitySubject =
  | { readonly kind: 'feide'; readonly feideId: string }
  | { readonly kind: 'lti'; readonly issuer: string; readonly subject: string };

/**
 * The checked learner source for `deriveLearnerKey` (DATA-002).
 * @param subject - The Feide ID or the LTI issuer and subject.
 * @returns A fresh LearnerSource with the same values.
 * @throws Error when the Feide ID is not normalised, or an LTI part is empty or the issuer contains `|`.
 * @spec DATA-002
 */
export function learnerSourceOf(subject: IdentitySubject): LearnerSource {
  const source: LearnerSource =
    subject.kind === 'feide'
      ? { kind: 'feide', feideId: subject.feideId }
      : { kind: 'lti', issuer: subject.issuer, subject: subject.subject };
  if (source.kind === 'feide') {
    const { feideId } = source;
    // SECURITY: `Ola@HVL.no ` and `ola@hvl.no` must never hash differently, or one person gets two accounts (D-054).
    if (feideId !== feideId.trim().toLowerCase() || !FEIDE_ID_PATTERN.test(feideId)) {
      throw new Error('the Feide subject must be a normalised Feide ID');
    }
  }
  pseudonymSource(source);
  return source;
}

/**
 * The text hashed into `Identity.subjectHash` with the `identity-subject` key (D-055).
 * @param subject - The Feide ID or the LTI issuer and subject.
 * @returns `feide|<feide-id>` or `lti|<iss>|<sub>`, the same text the learnerKey is derived from.
 * @throws Error when the subject is not valid (see `learnerSourceOf`).
 * @spec DATA-002
 */
export function identitySource(subject: IdentitySubject): string {
  // PRIVACY: the returned text holds the raw identifier; it is only ever passed to a keyed hash, never stored or
  // logged (DATA-002).
  return pseudonymSource(learnerSourceOf(subject));
}
