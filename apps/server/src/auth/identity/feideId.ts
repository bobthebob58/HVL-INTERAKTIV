/**
 * feideId — the one rule that turns a Feide ID as written into the form the server hashes, compares and lists.
 *
 * Why: D-054 makes the Feide ID the Feide subject: the identity hash, the learnerKey, `ADMIN_FEIDE_IDS`, the
 *      account link from Canvas (`custom.feide_login`, D-063), the people search and the data-subject tool all
 *      start from it, so every one of them must read it by the same rule. The rule tidies the ID before it checks
 *      it, and a tidy-up by Unicode's rules would make a look-alike (`K` written as U+212A, a no-break space at an
 *      end) the same ID as the plain one: a look-alike login ID from Canvas would then name another person's
 *      account (D-142).
 * Spec: AUTH-002, AUTH-005, DATA-008
 * Invariants:
 *   - Only SP and HTAB are trimmed and only `A`–`Z` are lower-cased (./asciiText.ts); every other character stays
 *     as written. Then `FEIDE_ID_PATTERN` must match: one `@`, before it no `@`, comma or white space of any kind,
 *     after it a lower-case ASCII host name.
 *   - So two IDs as written give the same Feide ID only when they differ in ASCII case or in blanks at their ends.
 *   - What Feide's own rules allow before the `@` is not assumed: a letter outside ASCII is kept, never changed.
 * Collaborators: ../feide/feideClaims.ts (login), ./linkDecision.ts (Canvas link), ./subjectSources.ts,
 *   ../feide/FeideRoleMapper.ts, ../../learningDesign/collaboration/PeopleDirectory.ts,
 *   ../../privacy/dsr/dataSubject.ts, ../../config/envParsers.ts (the pattern, and `ADMIN_FEIDE_IDS` by the same
 *   folding).
 * Tests: apps/server/test/auth/identity/feideId.test.ts
 */
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import { asciiLowerCase, trimAsciiBlanks } from './asciiText.js';

/**
 * Normalises a Feide ID.
 * @param raw - A Feide ID as a claim, a launch, a search or an operator gave it.
 * @returns The Feide ID, e.g. `ola@hvl.no` for ` Ola@HVL.no`; undefined when the value is not one.
 * @spec AUTH-002
 */
export function normaliseFeideId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  // SECURITY: ASCII only on purpose: by Unicode's rules U+212A would become `k` and a no-break space would go.
  const feideId = asciiLowerCase(trimAsciiBlanks(raw));
  return FEIDE_ID_PATTERN.test(feideId) ? feideId : undefined;
}

/**
 * Tells whether a value already is a normalised Feide ID.
 * @param value - A Feide subject held in memory.
 * @returns True when `normaliseFeideId` would return the value unchanged.
 */
export const isNormalisedFeideId = (value: string): boolean => normaliseFeideId(value) === value;
