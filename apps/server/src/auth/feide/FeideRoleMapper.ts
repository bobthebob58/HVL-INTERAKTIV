/**
 * FeideRoleMapper — turns a Feide user's organisation and groups into their roles in HVL Interaktiv.
 *
 * Why: AUTH-002 maps Feide affiliations to roles, and D-059 settles what its table leaves open: how a course group
 *      matches `AUTHOR_COURSE_GROUPS`, and that `ADMIN_FEIDE_IDS` grants admin only to an HVL member. Roles are
 *      computed once, at login (D-057), from the Groups API answer (D-054).
 * Spec: AUTH-002
 * Invariants:
 *   - The organisation is the Feide ID's realm, and it counts only when the Groups API lists that organisation's
 *     group (`type: "fc:org"`, `id: "fc:org:<realm>"`); that group's `membership.affiliation` list holds the
 *     affiliations. No such group → not an HVL member (fail closed, D-054).
 *   - Not an HVL member (realm not in `ALLOWED_FEIDE_ORGS`, or no organisation group) → `learner` only, never admin.
 *   - `employee`, `faculty` or `staff` → `author`; else `student` in an allow-listed course group → `author` with
 *     `studentAuthor`; everything else (`member`, `affiliate`, `alum`, `library-walk-in`, unknown) → `learner`.
 *   - `admin` is added for a Feide ID in `ADMIN_FEIDE_IDS` of an HVL member, and never otherwise (D-059).
 *   - A course-group entry matches a group ID exactly or as a prefix followed by `:`, ignoring case (D-059), and
 *     counts only while its membership is valid: a membership is listed and not `active: false`, and now lies within
 *     the membership's and the group's `notBefore`/`notAfter` when Feide sends them (an unreadable date counts as
 *     not valid), so a former student of an author course does not stay an author.
 *   - The Groups API answer is read defensively: a value of an unexpected shape grants nothing.
 * Collaborators: ./feideClaims.ts (the Feide ID), ./feideGroups.ts (the Groups API call), ./completeFeideLogin.ts,
 *   ../Principal.ts, ../../config/env.ts (ALLOWED_FEIDE_ORGS, ADMIN_FEIDE_IDS, AUTHOR_COURSE_GROUPS).
 * Tests: apps/server/test/auth/feide/FeideRoleMapper.test.ts
 */
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import type { Role } from '../Principal.js';

/** Affiliations that make an HVL member an author (spec 02 `AUTH-002`, first row). */
export const STAFF_AFFILIATIONS: readonly string[] = ['employee', 'faculty', 'staff'];

/** What the mapper needs to know about the user. */
export interface FeideRoleInput {
  /** The normalised Feide ID from `readFeideIdentity`, e.g. `ola@hvl.no`. */
  readonly feideId: string;
  /** The Groups API answer (`GET /groups/me/groups`) as parsed JSON: a list of group objects. */
  readonly groups: unknown;
}

/** The role configuration, as `env.ts` parses it (all entries lower-cased). */
export interface FeideRolePolicy {
  /** `ALLOWED_FEIDE_ORGS`, e.g. `['hvl.no']`. */
  readonly allowedOrgs: readonly string[];
  /** `ADMIN_FEIDE_IDS`. */
  readonly adminFeideIds: readonly string[];
  /** `AUTHOR_COURSE_GROUPS`: group IDs or ID prefixes, e.g. `fc:fs:fs:emne:hvl.no:ppu101`. */
  readonly authorCourseGroups: readonly string[];
}

/** The roles and facts a Feide principal carries (D-053). */
export interface FeideRoles {
  /** `['learner']` or `['author']`, plus `'admin'` for a listed HVL member. */
  readonly roles: readonly Role[];
  /** The realm is in `ALLOWED_FEIDE_ORGS` and the Groups API confirms the organisation. */
  readonly hvlMember: boolean;
  /** An author only through `AUTHOR_COURSE_GROUPS` (may share `private` only, D-059). */
  readonly studentAuthor: boolean;
  /** The organisation the user logged in through: the realm of the Feide ID, e.g. `hvl.no`. */
  readonly realm: string;
}

type JsonObject = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A group's ID, lower-cased; undefined when the group or its ID is not what Feide sends. */
const groupIdOf = (group: unknown): string | undefined =>
  isObject(group) && typeof group.id === 'string' ? group.id.toLowerCase() : undefined;

/** The affiliation strings of a group membership; an unexpected shape yields none. */
function affiliationsOf(group: JsonObject): ReadonlySet<string> {
  const membership = group.membership;
  const affiliation = isObject(membership) ? membership.affiliation : undefined;
  // SECURITY: only a list counts; `"employee"` as a bare string or a substring such as `"non-employee"` grants nothing.
  if (!Array.isArray(affiliation)) return new Set();
  return new Set(affiliation.filter((entry): entry is string => typeof entry === 'string'));
}

/**
 * Tells whether a group ID matches an `AUTHOR_COURSE_GROUPS` entry (D-059).
 * @param groupId - A group ID from the Groups API, e.g. `fc:fs:fs:emne:hvl.no:ppu101:1`.
 * @param entry - A configured ID or prefix, e.g. `fc:fs:fs:emne:hvl.no:ppu101`.
 * @returns True for an exact match or `entry` followed by `:`, ignoring case.
 */
export function matchesCourseGroup(groupId: string, entry: string): boolean {
  const id = groupId.toLowerCase();
  const wanted = entry.toLowerCase();
  // WHY: the `:` boundary keeps `…:ppu101` from matching the unrelated course `…:ppu1012:1`.
  return id === wanted || id.startsWith(`${wanted}:`);
}

/**
 * Tells whether a course-group membership is valid now: Feide must list a membership that is not marked
 * `active: false`, within the membership's and the group's own `notBefore`/`notAfter`.
 * @param group - A group object from the Groups API.
 * @param now - The current time.
 * @returns False without a membership, for an inactive one, outside either window, and for an unreadable date.
 */
function membershipValidAt(group: unknown, now: Date): boolean {
  // SECURITY: a course group without a membership, or with `active: false`, is a past course (former students).
  if (!isObject(group) || !isObject(group.membership) || group.membership.active === false) return false;
  const bound = (value: unknown): number | undefined | false => {
    if (value === undefined || value === null) return undefined;
    const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;
    return Number.isNaN(time) ? false : time;
  };
  const within = (holder: JsonObject): boolean => {
    const from = bound(holder.notBefore);
    const until = bound(holder.notAfter);
    // SECURITY: an unreadable date cannot prove the membership is current, so it grants nothing.
    if (from === false || until === false) return false;
    return (from === undefined || now.getTime() >= from) && (until === undefined || now.getTime() < until);
  };
  return within(group.membership) && within(group);
}

/** Freezes the result and its role list, so no caller can add a role afterwards. */
const freeze = (roles: FeideRoles): FeideRoles =>
  Object.freeze({ ...roles, roles: Object.freeze([...roles.roles]) });

/**
 * Maps a Feide user to roles (spec 02 `AUTH-002` table, read as D-059 says).
 * @param input - The normalised Feide ID and the Groups API answer.
 * @param policy - `ALLOWED_FEIDE_ORGS`, `ADMIN_FEIDE_IDS` and `AUTHOR_COURSE_GROUPS`.
 * @param now - The login time, for course-membership validity.
 * @returns Frozen roles and facts.
 * @throws Error when `feideId` is not a normalised Feide ID (a programming error; the ID is not echoed).
 * @spec AUTH-002
 */
export function mapFeideRoles(
  input: FeideRoleInput,
  policy: FeideRolePolicy,
  now: Date = new Date(),
): FeideRoles {
  const { feideId } = input;
  if (feideId !== feideId.toLowerCase() || !FEIDE_ID_PATTERN.test(feideId)) {
    throw new Error('mapFeideRoles needs a normalised Feide ID');
  }
  const realm = feideId.slice(feideId.indexOf('@') + 1);
  const groups: readonly unknown[] = Array.isArray(input.groups) ? input.groups : [];
  const orgGroup = groups.find(
    (group): group is JsonObject =>
      isObject(group) && group.type === 'fc:org' && groupIdOf(group) === `fc:org:${realm}`,
  );
  // SECURITY: membership needs both an allowed realm and Feide's confirmation of it; without the organisation
  // group the user's affiliation is unknown, so they get the least access (fail closed, D-054).
  const hvlMember = orgGroup !== undefined && policy.allowedOrgs.includes(realm);
  if (!hvlMember) return freeze({ roles: ['learner'], hvlMember: false, studentAuthor: false, realm });

  const affiliations = affiliationsOf(orgGroup);
  const staff = STAFF_AFFILIATIONS.some((affiliation) => affiliations.has(affiliation));
  const groupIds = groups
    .filter((group) => membershipValidAt(group, now))
    .map(groupIdOf)
    .filter((id): id is string => id !== undefined);
  const inAuthorCourse = groupIds.some((id) =>
    policy.authorCourseGroups.some((entry) => matchesCourseGroup(id, entry)),
  );
  // WHY: a student who is also employed authors as staff, so the student-author sharing limit does not apply.
  const studentAuthor = !staff && affiliations.has('student') && inAuthorCourse;
  const base: Role = staff || studentAuthor ? 'author' : 'learner';
  // SECURITY: reached only for an HVL member, so a listed Feide ID of another organisation never becomes admin (D-059).
  const admin = policy.adminFeideIds.includes(feideId);
  return freeze({ roles: admin ? [base, 'admin'] : [base], hvlMember, studentAuthor, realm });
}
