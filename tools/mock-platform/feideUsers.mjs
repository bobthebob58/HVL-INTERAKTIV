/**
 * feideUsers — the mock Feide's users and what Feide releases about them: ID-token and userinfo claims, and the
 * groups that the Groups API returns, both narrowed by the scopes the client asked for.
 *
 * Why: AUTH-001…AUTH-004 depend on Feide's real claim and group shapes (the Feide ID claim, `userid_sec`, the
 *      `fc:org` group with `membership.affiliation`, FS course groups). The shapes come from
 *      docs/reference/feide-values.md, so the tool is tested against what Feide sends, not against our guess.
 * Spec: AUTH-001, AUTH-002, AUTH-004
 * Invariants:
 *   - `sub` is a UUID; the Feide ID is released as `https://n.feide.no/claims/eduPersonPrincipalName` and as a
 *     `feide:<id>` entry in `https://n.feide.no/claims/userid_sec`, only with the `userid-feide` scope.
 *   - Scope `openid` alone releases everything (Feide's rule); explicit scopes narrow it: `profile` → `name`,
 *     `email` → `email`, `groups-org` → the `fc:org` group, `groups-edu` → FS groups.
 *   - A user marked `withoutFeideId` never gets the Feide ID claims (e.g. a guest or social login).
 *   - No national identity number is ever produced, whatever the scope.
 * Collaborators: ./mockFeide.mjs.
 * Tests: tools/mock-platform/test/mockFeide.test.mjs
 */
import { randomUUID } from 'node:crypto';

/** The Feide ID claim (`eduPersonPrincipalName`). */
export const FEIDE_ID_CLAIM = 'https://n.feide.no/claims/eduPersonPrincipalName';
/** The namespaced user IDs claim, e.g. `["feide:name@hvl.no"]`. */
export const USERID_SEC_CLAIM = 'https://n.feide.no/claims/userid_sec';
/** The `eduPersonAffiliation` values Feide permits. */
export const FEIDE_AFFILIATIONS = Object.freeze([
  'faculty',
  'student',
  'staff',
  'alum',
  'member',
  'affiliate',
  'employee',
  'library-walk-in',
]);
const PRIMARY_ORDER = [
  'employee',
  'faculty',
  'staff',
  'student',
  'affiliate',
  'alum',
  'member',
  'library-walk-in',
];
const ORG_NAMES = { 'hvl.no': 'Høgskulen på Vestlandet', 'uib.no': 'Universitetet i Bergen' };

/** The demo users every mock Feide starts with; `author` logs in when no other user is chosen. */
export const FEIDE_DEMO_USERS = Object.freeze([
  {
    key: 'author',
    feideId: 'author@hvl.no',
    sub: '6f1c3b7e-2d4a-4c1f-9a7b-0e5d8c2f4a11',
    name: 'Aud Forfattar',
    email: 'author@hvl.no',
    realm: 'hvl.no',
    affiliations: ['member', 'employee', 'faculty'],
  },
  {
    key: 'student',
    feideId: 'student@hvl.no',
    sub: '1a9e6d2c-7b3f-4e8a-b5c1-3f2d9e7a6b22',
    name: 'Siri Student',
    email: 'student@stud.hvl.no',
    realm: 'hvl.no',
    affiliations: ['member', 'student'],
  },
  {
    key: 'ppu-student',
    feideId: 'ppu.student@hvl.no',
    sub: '8c4b2a1e-5f7d-4b9c-a3e6-2d1f8b7c5e33',
    name: 'Per Pedagog',
    email: 'ppu.student@stud.hvl.no',
    realm: 'hvl.no',
    affiliations: ['member', 'student'],
    groups: ['fc:fs:fs:emne:hvl.no:PPU101:1'],
  },
  {
    key: 'uib-employee',
    feideId: 'gjest@uib.no',
    sub: '3e7d5c9b-1a2f-4d6e-8b4c-9f3a2e1d7c44',
    name: 'Gunn Gjest',
    email: 'gjest@uib.no',
    realm: 'uib.no',
    affiliations: ['member', 'employee', 'staff'],
  },
  {
    key: 'no-feide-id',
    sub: '5b2a8f4d-9c1e-4a7b-b6d3-4e8c1f9a2d55',
    name: 'Ola Utan-Feide-ID',
    email: 'ola@example.org',
    realm: 'hvl.no',
    affiliations: ['affiliate'],
    withoutFeideId: true,
  },
]);

/** The group type of an FS group ID, e.g. `fc:fs:emne` for `fc:fs:fs:emne:hvl.no:PPU101:1`. */
const groupType = (id) =>
  /^fc:fs:fs:(emne|prg|kull|klasse|str)(?=:)/.exec(id)?.[0].replace('fc:fs:fs:', 'fc:fs:');

/**
 * Checks a user description and fills in the defaults.
 * @param {object} spec - `{key, feideId?, sub?, name?, email?, realm?, affiliations?, groups?, withoutFeideId?}`.
 * @returns {object} The user, with `feideId` undefined when `withoutFeideId` is set.
 * @throws {TypeError} For a missing key, an affiliation Feide does not permit, or a string group that is not an
 *   FS group ID (other groups are passed as Feide group objects).
 */
export function normaliseFeideUser(spec) {
  if (typeof spec?.key !== 'string' || spec.key === '') throw new TypeError('a Feide user needs a key');
  const affiliations = [...(spec.affiliations ?? ['member'])];
  const unknown = affiliations.filter((value) => !FEIDE_AFFILIATIONS.includes(value));
  if (unknown.length > 0) throw new TypeError(`unknown Feide affiliation: ${unknown.join(', ')}`);
  const notFs = (spec.groups ?? []).filter((group) => typeof group === 'string' && !groupType(group));
  if (notFs.length > 0)
    throw new TypeError(`not an FS group ID (pass other groups as objects): ${notFs.join(', ')}`);
  const realm = spec.realm ?? 'hvl.no';
  return {
    key: spec.key,
    sub: spec.sub ?? randomUUID(),
    name: spec.name ?? spec.key,
    email: spec.email,
    realm,
    affiliations,
    groups: [...(spec.groups ?? [])],
    feideId: spec.withoutFeideId ? undefined : (spec.feideId ?? `${spec.key}@${realm}`),
  };
}

/** Feide's scope rule: `openid` alone releases every attribute group; otherwise only the listed ones. */
const scopeTest = (scope) => {
  const scopes = new Set(
    String(scope ?? '')
      .split(' ')
      .filter(Boolean),
  );
  const everything = scopes.size === 1 && scopes.has('openid');
  return (name) => everything || scopes.has(name);
};

/**
 * The claims Feide releases in the ID token and at userinfo.
 * @param {object} user - From `normaliseFeideUser`.
 * @param {string} scope - The space-separated scopes of the authorisation request.
 * @returns {Record<string, unknown>} `sub` plus the claims the scopes release.
 */
export function feideClaims(user, scope) {
  const has = scopeTest(scope);
  const claims = { sub: user.sub };
  if (has('profile')) claims.name = user.name;
  if (has('email') && user.email) claims.email = user.email;
  if (has('userid-feide') && user.feideId) {
    claims[FEIDE_ID_CLAIM] = user.feideId;
    claims[USERID_SEC_CLAIM] = [`feide:${user.feideId}`];
  }
  return claims;
}

/**
 * The groups `GET /groups/me/groups` returns for a user, in Feide's format.
 * @param {object} user - From `normaliseFeideUser`.
 * @param {string} scope - The scopes the access token was issued for.
 * @returns {object[]} The `fc:org` group (with `groups-org`) and FS groups (with `groups-edu`).
 */
export function feideGroups(user, scope) {
  const has = scopeTest(scope);
  const groups = [];
  if (has('groups-org')) {
    const primaryAffiliation = PRIMARY_ORDER.find((value) => user.affiliations.includes(value));
    groups.push({
      id: `fc:org:${user.realm}`,
      type: 'fc:org',
      displayName: ORG_NAMES[user.realm] ?? user.realm,
      public: true,
      orgType: ['higher_education'],
      membership: { basic: 'member', affiliation: [...user.affiliations], primaryAffiliation },
    });
  }
  if (has('groups-edu')) {
    for (const group of user.groups) {
      if (typeof group !== 'string') groups.push(structuredClone(group));
      else
        groups.push({
          id: group,
          type: groupType(group),
          displayName: group.split(':').at(-2) ?? group,
          parent: `fc:org:${user.realm}`,
          membership: { basic: 'member', active: true, displayName: 'Student', fsroles: ['STUDENT'] },
        });
    }
  }
  return groups;
}
