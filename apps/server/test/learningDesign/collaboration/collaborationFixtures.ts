/**
 * collaborationFixtures — people for the PROD-007 route tests on the API testbed: HVL staff colleagues can find, the
 * people who must never be found, and a run token so a name search meets only this file's people.
 *
 * Why: the directory, co-author and bank tests need the same kinds of account (D-090 as amended): an eligible staff
 *      author whose last Feide login is recent, and a student author, a learner, a Canvas-only account, an
 *      admin-only member and an expired staff author, who are never found. Each is a testbed principal, so the
 *      testbed's `close()` removes them with their activities and audit rows.
 * Spec: PROD-007
 * Invariants: display names carry the run token, so tests in parallel never see each other's people.
 * Collaborators: ../../support/apiTestbed.ts, ../metadata/metadataFixtures.ts (`LTI_LAUNCH`).
 * Tests: used by apps/server/test/learningDesign/collaboration/*.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { Principal, Role } from '../../../src/auth/Principal.js';
import type { ApiTestbed, TestPrincipal } from '../../support/apiTestbed.js';
import { LTI_LAUNCH } from '../metadata/metadataFixtures.js';

/** The facts of a Canvas launch principal (LTI accounts are never HVL members, D-098). */
export const LTI_OVERRIDES: Partial<Principal> = {
  mode: 'lti',
  hvlMember: false,
  feideAuthenticated: false,
  lti: LTI_LAUNCH,
};

/** A date more than 13 months ago: an eligible login that no longer counts. */
export const EXPIRED_LOGIN = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

/** The kinds of account the directory must refuse, with how each is made. */
export const NEVER_FINDABLE: readonly {
  readonly kind: string;
  readonly role: Role;
  readonly overrides?: Partial<Principal>;
  /** Their stored `coAuthorSearchableAt`: what their last Feide login wrote, or an old date. */
  readonly searchableAt: Date | null;
}[] = [
  { kind: 'a student author', role: 'author', overrides: { studentAuthor: true }, searchableAt: null },
  { kind: 'a Canvas-only account', role: 'author', overrides: LTI_OVERRIDES, searchableAt: null },
  { kind: 'a learner', role: 'learner', searchableAt: null },
  { kind: 'an admin-only member', role: 'admin', searchableAt: null },
  { kind: 'a staff author whose last eligible login is old', role: 'author', searchableAt: EXPIRED_LOGIN },
];

/** A short token unique to this run, for display names a name search can find. */
export const runToken = (): string => randomUUID().slice(0, 8);

/**
 * Makes a principal and gives its account a display name and a `coAuthorSearchableAt`.
 * @param tb - The API testbed.
 * @param displayName - The account's display name (learners keep none: the database refuses one).
 * @param options - The role (author by default), principal overrides and the stored date (now by default).
 * @returns The principal.
 */
export async function personNamed(
  tb: ApiTestbed,
  displayName: string,
  options: { role?: Role; overrides?: Partial<Principal>; searchableAt?: Date | null } = {},
): Promise<TestPrincipal> {
  const person = await tb.principal(options.role ?? 'author', options.overrides);
  const searchableAt = options.searchableAt === undefined ? new Date() : options.searchableAt;
  const named = options.role !== 'learner';
  await tb.db.user.update({
    where: { id: person.principal.userId },
    data: { coAuthorSearchableAt: searchableAt, ...(named ? { displayName } : {}) },
  });
  return person;
}
