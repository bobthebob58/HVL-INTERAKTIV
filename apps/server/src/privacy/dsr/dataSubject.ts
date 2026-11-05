/**
 * dataSubject — reads who a data-subject request is about: a Feide ID and/or Canvas `(iss, sub)` pairs, given to the
 * CLI as one JSON object on standard input, checked and normalised as a login or launch would see them.
 *
 * Why: DATA-008 takes a Feide ID or an `(iss, sub)` pair, and D-108 finds the learner by deriving their pseudonyms
 *      from exactly those values. A Feide ID typed with capitals or spaces must give the same key as at login (D-054),
 *      while `iss` and `sub` are case-sensitive and taken as the launch carried them. D-108's amendment of 2026-11-04
 *      reads them from standard input, so they never stay in the shell's history or show in the process list.
 * Spec: DATA-008, DATA-002
 * Invariants:
 *   - At least one identifier; only the fields `feideId` and `lti`; at most `MAX_LTI_SUBJECTS` Canvas subjects.
 *   - PRIVACY: an error names the field (`feideId`, `lti[2].sub`), never a value; `JSON.parse`'s own message, which can
 *     quote the input, is replaced (DATA-009).
 *   - The result holds the identifiers in memory only; nothing here stores or prints them.
 * Collaborators: ../../config/envParsers.ts (FEIDE_ID_PATTERN), ../../auth/identity/subjectSources.ts (the same checks
 *   as login and launch), ./subjectKeys.ts, ./dsrCli.ts.
 * Tests: apps/server/test/privacy/dsr/dataSubject.test.ts
 */
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import { learnerSourceOf } from '../../auth/identity/subjectSources.js';

/** One Canvas user: the platform's issuer and the user's `sub` there (Canvas's `lti_id`). */
export interface LtiSubject {
  /** The platform's `iss`, exactly as its launches carry it. */
  readonly issuer: string;
  /** The user's `sub`, exactly as its launches carry it. */
  readonly subject: string;
}

/** Who a data-subject request is about, as HVL operations can verify it. */
export interface DataSubject {
  /** The normalised Feide ID (D-054), when the request gives one. */
  readonly feideId?: string;
  /** The Canvas identities the request gives, without duplicates. */
  readonly lti: readonly LtiSubject[];
}

/** Thrown when standard input does not describe a data subject; the message names fields only. */
export class DataSubjectInputError extends Error {
  /**
   * @param message - What is wrong, by field name.
   */
  constructor(message: string) {
    super(message);
    this.name = 'DataSubjectInputError';
  }
}

/** The most Canvas subjects one request may name. */
export const MAX_LTI_SUBJECTS = 20;

/** The most characters a `sub` may have (LTI 1.3 Core §5.3.6: at most 255 ASCII characters). */
const MAX_SUB_LENGTH = 255;

/**
 * Normalises a Feide ID as the login does (trimmed, lower-cased, D-054).
 * @param raw - What the operator gave.
 * @returns The Feide ID, or undefined when it is not one.
 * @spec DATA-008
 */
export function normaliseFeideId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const feideId = raw.trim().toLowerCase();
  return FEIDE_ID_PATTERN.test(feideId) ? feideId : undefined;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A part of a Canvas identity: non-empty, without spaces at either end, as launches carry it. */
const isExactPart = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value !== '' && value === value.trim() && value.length <= maxLength;

/** Reads one entry of `lti`; `position` is 1-based, for the error message. */
function ltiSubjectOf(entry: unknown, position: number): LtiSubject {
  const field = `lti[${position}]`;
  if (!isPlainObject(entry) || Object.keys(entry).some((key) => key !== 'issuer' && key !== 'sub')) {
    throw new DataSubjectInputError(`${field} must be an object with only "issuer" and "sub"`);
  }
  const { issuer, sub } = entry;
  if (!isExactPart(issuer, 2048) || !URL.canParse(issuer) || issuer.includes('|')) {
    throw new DataSubjectInputError(
      `${field}.issuer must be the platform's issuer URL, exactly as Canvas sends it`,
    );
  }
  if (!isExactPart(sub, MAX_SUB_LENGTH)) {
    throw new DataSubjectInputError(`${field}.sub must be 1–255 characters without spaces at either end`);
  }
  // WHY: the same checks as at launch (subjectSources), so a key derived here is a key a launch could have made.
  learnerSourceOf({ kind: 'lti', issuer, subject: sub });
  return { issuer, subject: sub };
}

/**
 * Parses the data subject from standard input.
 * @param text - One JSON object, e.g. `{"feideId":"…","lti":[{"issuer":"…","sub":"…"}]}`.
 * @returns The checked, normalised identifiers.
 * @throws DataSubjectInputError naming the faulty field, never its value.
 * @spec DATA-008
 */
export function parseDataSubject(text: string): DataSubject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // PRIVACY: V8's message quotes the input it could not read, which is a Feide ID or a sub (DATA-009).
    throw new DataSubjectInputError('standard input is not one JSON object');
  }
  if (!isPlainObject(parsed)) throw new DataSubjectInputError('standard input is not one JSON object');
  // PRIVACY: an unknown key is not named, as an operator may have typed an identifier as a key.
  if (Object.keys(parsed).some((key) => key !== 'feideId' && key !== 'lti')) {
    throw new DataSubjectInputError('only the fields "feideId" and "lti" are allowed');
  }
  const feideId = parsed.feideId === undefined ? undefined : normaliseFeideId(parsed.feideId);
  if (parsed.feideId !== undefined && feideId === undefined) {
    throw new DataSubjectInputError('feideId is not a Feide ID like name@hvl.no');
  }
  const entries = parsed.lti ?? [];
  if (!Array.isArray(entries) || entries.length > MAX_LTI_SUBJECTS) {
    throw new DataSubjectInputError(`lti must be a list of at most ${MAX_LTI_SUBJECTS} Canvas identities`);
  }
  const lti = entries
    .map((entry, index) => ltiSubjectOf(entry, index + 1))
    .filter(
      (one, index, all) =>
        all.findIndex((other) => other.issuer === one.issuer && other.subject === one.subject) === index,
    );
  if (feideId === undefined && lti.length === 0) {
    throw new DataSubjectInputError('give a feideId, an lti identity, or both');
  }
  return feideId === undefined ? { lti } : { feideId, lti };
}
