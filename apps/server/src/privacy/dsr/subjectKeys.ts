/**
 * subjectKeys — every pseudonym a data subject can have: the `learnerKey` for each configured academic year and each
 * identifier (the Feide variant and each Canvas variant), and the `Identity.subjectHash` under every identity key.
 *
 * Why: learner rows store no identifier, only the yearly HMAC pseudonym (DATA-002), and accounts only a keyed hash
 *      (D-055). DATA-008 and D-108 find a learner's rows by deriving, in memory, every key the person's identifiers
 *      give under the retained years' secrets (`PSEUDONYM_SECRETS`), and every hash under `IDENTITY_HASH_KEYS`.
 * Spec: DATA-008, DATA-002
 * Invariants:
 *   - One key per (configured year, identifier), made by `deriveLearnerKey` at a moment inside that academic year, so
 *     it is exactly the key a login or launch in that year made.
 *   - No configured secret → `NoPseudonymSecretsError`, before any database read (D-108's amendment).
 *   - PRIVACY: keys and hashes stay in memory; the identifiers are never part of the result (DATA-002).
 * Collaborators: ../deriveLearnerKey.ts, ../academicYear.ts, ../../auth/identity/subjectSources.ts,
 *   ../../security/keys/IdentityHasher.ts, ./dataSubject.ts, ./subjectRows.ts.
 * Tests: apps/server/test/privacy/dsr/subjectKeys.test.ts
 */
import { identitySource, learnerSourceOf, type IdentitySubject } from '../../auth/identity/subjectSources.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import { academicYearOf } from '../academicYear.js';
import { deriveLearnerKey } from '../deriveLearnerKey.js';
import type { PseudonymSecrets } from '../pseudonymSecrets.js';
import type { DataSubject } from './dataSubject.js';

/** Thrown when `PSEUDONYM_SECRETS` holds no secret: then no learner row can be found. */
export class NoPseudonymSecretsError extends Error {
  constructor() {
    super(
      'no pseudonym secret is configured (PSEUDONYM_SECRETS); a data-subject request cannot find any row',
    );
    this.name = 'NoPseudonymSecretsError';
  }
}

/** One pseudonym of the data subject: which year's secret and which identifier made it. */
export interface SubjectPseudonym {
  /** The 43-character `learnerKey`. */
  readonly learnerKey: string;
  /** The academic year of the secret that made it. */
  readonly academicYear: number;
  /** `feide` for the Feide ID; `lti` for a Canvas identity. */
  readonly variant: 'feide' | 'lti';
  /** For `lti`: the identity's 1-based place in the request's `lti` list. */
  readonly ltiIndex?: number;
}

/** Everything the CLI looks rows up by. */
export interface SubjectKeys {
  /** The configured secrets' academic years, oldest first. */
  readonly years: readonly number[];
  /** Every pseudonym, by year, then Feide before Canvas. */
  readonly pseudonyms: readonly SubjectPseudonym[];
  /** The pseudonyms' keys, without duplicates. */
  readonly learnerKeys: readonly string[];
  /** `Identity.subjectHash` candidates under every identity key, per provider. */
  readonly identityHashes: { readonly feide: readonly string[]; readonly lti: readonly string[] };
  /** How many identifiers of each kind the request gave (for the audit: counts only). */
  readonly identifiers: { readonly feide: number; readonly lti: number };
}

/**
 * A moment inside an academic year: 15 January of the year after it starts, at noon UTC.
 * @param year - The academic year (its starting calendar year).
 * @returns The moment.
 * @throws Error when the academic calendar would place the moment in another year (a programming error).
 */
export function momentInAcademicYear(year: number): Date {
  const moment = new Date(Date.UTC(year + 1, 0, 15, 12));
  if (academicYearOf(moment) !== year)
    throw new Error(`15 January ${year + 1} is not in academic year ${year}`);
  return moment;
}

/**
 * Derives every key and hash of a data subject.
 * @param subject - The checked identifiers (./dataSubject.ts).
 * @param secrets - `PSEUDONYM_SECRETS`.
 * @param hasher - The identity hasher (`IDENTITY_HASH_KEYS`).
 * @returns The keys, the hashes, the years searched and the identifier counts.
 * @throws NoPseudonymSecretsError when no secret is configured.
 * @spec DATA-008
 */
export function deriveSubjectKeys(
  subject: DataSubject,
  secrets: PseudonymSecrets,
  hasher: IdentityHasher,
): SubjectKeys {
  if (secrets.size === 0) throw new NoPseudonymSecretsError();
  const years = [...secrets.keys()].sort((a, b) => a - b);
  const identities: {
    readonly variant: 'feide' | 'lti';
    readonly ltiIndex?: number;
    readonly id: IdentitySubject;
  }[] = [
    ...(subject.feideId === undefined
      ? []
      : [{ variant: 'feide' as const, id: { kind: 'feide' as const, feideId: subject.feideId } }]),
    ...subject.lti.map((one, index) => ({
      variant: 'lti' as const,
      ltiIndex: index + 1,
      id: { kind: 'lti' as const, issuer: one.issuer, subject: one.subject },
    })),
  ];
  const pseudonyms = years.flatMap((academicYear) =>
    identities.map(({ variant, ltiIndex, id }) => ({
      learnerKey: deriveLearnerKey(learnerSourceOf(id), secrets, momentInAcademicYear(academicYear)),
      academicYear,
      variant,
      ...(ltiIndex === undefined ? {} : { ltiIndex }),
    })),
  );
  const hashesOf = (variant: 'feide' | 'lti') =>
    identities
      .filter((one) => one.variant === variant)
      .flatMap(({ id }) => hasher.candidates('identity-subject', identitySource(id)).map((c) => c.hash));
  return {
    years,
    pseudonyms,
    learnerKeys: [...new Set(pseudonyms.map((one) => one.learnerKey))],
    identityHashes: { feide: hashesOf('feide'), lti: hashesOf('lti') },
    identifiers: { feide: subject.feideId === undefined ? 0 : 1, lti: subject.lti.length },
  };
}
