/**
 * feideClaims — reads the Feide ID from Feide's ID-token claims, and the name that is kept for authors only.
 *
 * Why: D-054 makes the Feide ID (`eduPersonPrincipalName`) the Feide subject for the identity hash, the learnerKey,
 *      `ADMIN_FEIDE_IDS` and account linking. AUTH-004 notes that Feide releases a name and e-mail for every user
 *      once those attribute groups are authorised, so they are dropped for learners before anything is stored. The
 *      e-mail is dropped for everyone: nothing uses it (D-090 amendment 2026-10-29).
 * Spec: AUTH-004, AUTH-002, DATA-002
 * Invariants:
 *   - The Feide ID comes from `https://n.feide.no/claims/eduPersonPrincipalName` when that claim is present. Only
 *     when it is absent does it come from the `feide:` entries of `https://n.feide.no/claims/userid_sec`, which
 *     must all name the same ID. It is trimmed, lower-cased and must match FEIDE_ID_PATTERN. A present but
 *     malformed claim, or disagreeing `feide:` entries → undefined (friendly refusal, D-054): never a guess.
 *   - `sub` is not read here (D-054), and the national identity number claim is never read at all (AUTH-004).
 *   - A display name is returned only for authors and admins, only as short text without control characters;
 *     learners get an empty profile. The `email` claim is never read (SPEC-DEVIATION AUTH-004, D-090 amendment).
 * Collaborators: ./completeFeideLogin.ts, ./FeideRoleMapper.ts, ../identity/subjectSources.ts,
 *   ../../config/envParsers.ts (FEIDE_ID_PATTERN).
 * Tests: apps/server/test/auth/feide/feideClaims.test.ts
 */
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import { canAuthor, type Role } from '../Principal.js';

/** The claim holding the Feide ID, e.g. `ola@hvl.no` (attribute group `userid-feide`). */
export const FEIDE_ID_CLAIM = 'https://n.feide.no/claims/eduPersonPrincipalName';
/** The claim listing namespaced user IDs, e.g. `["feide:ola@hvl.no"]`. */
export const FEIDE_USERID_SEC_CLAIM = 'https://n.feide.no/claims/userid_sec';
/** The namespace of the Feide ID inside `userid_sec`. */
const FEIDE_NAMESPACE = 'feide:';

/** The longest display name stored for an author. */
export const MAX_DISPLAY_NAME_LENGTH = 200;

/** The Feide subject of a login (D-054). Held in memory only; stored only as a keyed hash. */
export interface FeideIdentity {
  /** Trimmed, lower-cased `eduPersonPrincipalName`, e.g. `ola@hvl.no`. */
  readonly feideId: string;
  /** The organisation part of the Feide ID, e.g. `hvl.no`. */
  readonly realm: string;
}

/** What may be stored about an author for co-author search and attribution (AUTH-004, D-090 as amended). */
export interface AuthorProfile {
  /** The `name` claim. */
  readonly displayName?: string;
}

const CONTROL_CHARACTER = /\p{Cc}/u;

/** A candidate Feide ID, normalised; undefined when it is not one. */
function normalisedFeideId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const feideId = value.trim().toLowerCase();
  return FEIDE_ID_PATTERN.test(feideId) ? feideId : undefined;
}

/** The one Feide ID that every `feide:` entry of `userid_sec` names; undefined when there is none or several. */
function secondaryFeideId(claims: Readonly<Record<string, unknown>>): string | undefined {
  const listed = claims[FEIDE_USERID_SEC_CLAIM];
  if (!Array.isArray(listed)) return undefined;
  // PRIVACY: only `feide:` entries are used; any other namespaced ID (a `nin:` entry appears only if `userid-nin`
  // were wrongly authorised) is skipped and never copied (AUTH-004, DATA-002).
  const ids = listed
    .filter((entry): entry is string => typeof entry === 'string' && entry.startsWith(FEIDE_NAMESPACE))
    .map((entry) => normalisedFeideId(entry.slice(FEIDE_NAMESPACE.length)));
  const [first] = ids;
  // SECURITY: a malformed or a second, different Feide ID makes the subject ambiguous, so none is chosen (D-054).
  return ids.every((id) => id !== undefined && id === first) ? first : undefined;
}

/**
 * Reads the Feide ID of a login (D-054).
 * @param claims - The validated ID-token claims from `FeideClient`.
 * @returns The normalised Feide ID and its realm, or undefined when the login carries none (guest, eduGAIN), a
 *   malformed one, or two different ones.
 * @spec AUTH-002
 */
export function readFeideIdentity(claims: Readonly<Record<string, unknown>>): FeideIdentity | undefined {
  const primary = claims[FEIDE_ID_CLAIM];
  // SECURITY: a present claim decides alone; a malformed one is refused, not replaced by another claim (D-054).
  const feideId = primary === undefined ? secondaryFeideId(claims) : normalisedFeideId(primary);
  if (feideId === undefined) return undefined;
  return Object.freeze({ feideId, realm: feideId.slice(feideId.indexOf('@') + 1) });
}

/** Trimmed text within `max` characters and without control characters; undefined otherwise. */
function boundedText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === '' || text.length > max || CONTROL_CHARACTER.test(text)) return undefined;
  return text;
}

/**
 * The name to store for a Feide user: authors and admins only (AUTH-004), never the e-mail (D-090 amendment).
 * @param claims - The validated ID-token claims.
 * @param roles - The roles from `mapFeideRoles`.
 * @returns The profile; empty for learners, and without a name that is missing, too long or malformed.
 * @spec AUTH-004
 */
export function authorProfile(
  claims: Readonly<Record<string, unknown>>,
  roles: readonly Role[],
): AuthorProfile {
  // PRIVACY: Feide releases name and e-mail for every user; a learner's are dropped here, before anything is
  // stored, so no learner row ever holds them (AUTH-004, DATA-002).
  if (!canAuthor({ roles })) return Object.freeze({});
  const displayName = boundedText(claims.name, MAX_DISPLAY_NAME_LENGTH);
  // SPEC-DEVIATION: D-090 amendment 2026-10-29: AUTH-004 kept an author's e-mail for co-author search, which
  // matches names and Feide IDs only. Nothing reads it, so it is not kept at all (data minimisation).
  return Object.freeze(displayName === undefined ? {} : { displayName });
}
