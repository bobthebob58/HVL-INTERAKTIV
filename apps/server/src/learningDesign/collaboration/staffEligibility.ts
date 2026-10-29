/**
 * staffEligibility — the one rule for who takes part in collaboration as HVL staff: who may be found and added as a
 * co-author, who may read the content bank, and whose activities may be listed in it.
 *
 * Why: D-090 (as amended) lets colleagues find only HVL staff authors, and D-091 (as amended) gives the bank to the
 *      same people. The name search, the exact Feide-ID lookup, the co-author check, the bank and the Feide login
 *      that records `User.coAuthorSearchableAt` must all decide alike, so they all ask this module.
 * Spec: PROD-007, AUTH-002, DATA-002
 * Invariants:
 *   - Eligible means an HVL member with the `author` role who is not a student author (`hvlMember`, `author`, not
 *     `studentAuthor`), as the Feide login computed them. An admin-only member and a student author are not
 *     eligible, although both have accounts of kind `staff`.
 *   - Being found or added also needs `coAuthorSearchableAt` set and less than 13 calendar months old: only a Feide
 *     login writes it (when eligible) and clears it (when not); an LTI launch never touches it, so a Canvas-only
 *     account can never be found.
 *   - An H5P actor is eligible for the bank only when signed in with Feide (an LTI actor is never an HVL member).
 * Collaborators: ../../auth/feide/completeFeideLogin.ts (writes the date), ./PeopleDirectory.ts (search and the
 *   add check), ./coAuthorRequests.ts (who may add), ./contentBank.ts and ./bankEntries.ts (the bank),
 *   ../http/collaborationRoutes.ts (who may search and read the bank), ./duplicateRules.ts (copying through the bank).
 * Tests: apps/server/test/learningDesign/collaboration/staffEligibility.test.ts,
 *   apps/server/test/auth/feide/coAuthorSearchable.int.test.ts
 */
import type { Principal } from '../../auth/Principal.js';
import type { HvlH5pActor } from '../../h5p/HvlH5pUser.js';

/** How long a Feide login keeps a person findable as a co-author (D-090): 13 calendar months. */
export const COAUTHOR_SEARCHABLE_MONTHS = 13;

/** The facts of a Feide login that decide eligibility. */
export type StaffFacts = Pick<Principal, 'roles' | 'hvlMember' | 'studentAuthor'>;

/**
 * Tells whether a person is an HVL staff author: may be found as a co-author (when also recent), read the bank and
 * list in it (D-090, D-091).
 * @param facts - The roles and facts of the person's Feide login (a portal principal, or the login itself).
 * @returns True for an HVL member with the `author` role who is not a student author.
 * @spec PROD-007
 */
export const isEligibleStaffAuthor = (facts: StaffFacts): boolean =>
  facts.hvlMember && facts.roles.includes('author') && !facts.studentAuthor;

/**
 * Tells whether the person behind a request is one the content bank is for.
 * @param principal - Who asks.
 * @returns True for a portal (Feide) principal who is an eligible staff author.
 * @spec PROD-007
 */
export const isBankReader = (principal: Principal): boolean =>
  principal.mode === 'portal' && isEligibleStaffAuthor(principal);

/**
 * The same rule for an H5P actor, for copying through the bank (`duplicateRules`, the editor's paste guard).
 * @param actor - The person, as the H5P routes and the duplicator see them.
 * @returns True for an author signed in with Feide, an HVL member, not a student author.
 * @spec PROD-007
 */
export const isBankReaderActor = (actor: HvlH5pActor): boolean =>
  // WHY: an actor's `role` is the highest one, so `admin` may also be an admin-only member; an admin may Edit every
  // activity and so never copies through the bank, which keeps this strict without knowing the other roles.
  actor.feideAuthenticated && actor.hvlMember && actor.role === 'author' && !actor.studentAuthor;

/**
 * The oldest `coAuthorSearchableAt` that still counts: 13 calendar months before `now` (UTC).
 * @param now - The current moment.
 * @returns The cut-off; a date at or before it no longer counts.
 */
export function searchableCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  // WHY: `setUTCMonth` rolls 31 March back to 3 March in a 28-day February; clamp to the month's last day instead.
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - COAUTHOR_SEARCHABLE_MONTHS);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}

/**
 * Tells whether a stored `coAuthorSearchableAt` still makes the person findable.
 * @param searchableAt - The stored date, or null when the last Feide login did not set it.
 * @param now - The current moment.
 * @returns True when set and after the cut-off.
 * @spec PROD-007
 */
export const isSearchable = (searchableAt: Date | null, now: Date): boolean =>
  searchableAt !== null && searchableAt.getTime() > searchableCutoff(now).getTime();

/**
 * The Prisma filter of the accounts that may be found and added as co-authors at `now`.
 * @param now - The current moment.
 * @returns A `User` filter: kind `staff` and a `coAuthorSearchableAt` after the cut-off.
 * @spec PROD-007
 */
export const findableStaffWhere = (now: Date) =>
  ({ kind: 'staff', coAuthorSearchableAt: { gt: searchableCutoff(now) } }) as const;

/**
 * What a Feide login records in `User.coAuthorSearchableAt` (D-090).
 * @param facts - The roles and facts the login computed.
 * @param now - The login time.
 * @returns `now` for an eligible staff author, else null (which clears an earlier date).
 * @spec PROD-007
 */
export const coAuthorSearchableAtFor = (facts: StaffFacts, now: Date): Date | null =>
  isEligibleStaffAuthor(facts) ? now : null;
