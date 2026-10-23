/**
 * Table-driven test of the H5P-006 matrix for activities, through HvlPermissionSystem with an in-memory
 * repository: every role x content permission x view x relation x status x visibility x reach x LTI launch.
 *
 * Spec: H5P-006, PROD-004, PROD-006
 */
import { describe, expect, it } from 'vitest';
import { ContentPermission } from '@lumieducation/h5p-server';
import { HvlPermissionSystem } from '../../../src/h5p/HvlPermissionSystem.js';
import {
  asAccountUser,
  asStateUser,
  type H5pRole,
  type H5pUserView,
  type HvlH5pActor,
} from '../../../src/h5p/HvlH5pUser.js';
import type {
  ContentFacts,
  ContentStatus,
  ContentVisibility,
} from '../../../src/h5p/permissions/ContentAccessRepository.js';
import type { DataSubjectAccess } from '../../../src/h5p/permissions/UserDataAccessAuditor.js';

const CONTENT_ID = '0192f0c4-0000-7000-8000-00000000c001';
const ME = '0192f0c4-0000-7000-8000-000000000001';
const SOMEONE_ELSE = '0192f0c4-0000-7000-8000-000000000002';
const { Create, List, View, Edit, Delete, Download, Embed } = ContentPermission;

type Relation = 'owner' | 'co-author' | 'other';
type Reach = 'outsider' | 'hvl' | 'feide' | 'hvl+feide';

const product = <T extends Record<string, readonly unknown[]>>(dims: T): { [K in keyof T]: T[K][number] }[] =>
  Object.entries(dims).reduce<Record<string, unknown>[]>(
    (rows, [key, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value }))),
    [{}],
  ) as { [K in keyof T]: T[K][number] }[];

const ROLES: H5pRole[] = ['learner', 'author', 'admin'];
const VIEWS: H5pUserView[] = ['account', 'state'];
/** Reaches every visibility level and opened the activity through LTI. */
const EVERYONE = { reach: 'hvl+feide', launched: true } as const;

const cells = product({
  role: ROLES,
  permission: Object.values(ContentPermission).filter((p): p is ContentPermission => typeof p === 'number'),
  view: VIEWS,
  relation: ['owner', 'co-author', 'other'] as Relation[],
  status: ['draft', 'published'] as ContentStatus[],
  visibility: ['private', 'organisation', 'feide'] as ContentVisibility[],
  reach: ['outsider', 'hvl', 'feide', 'hvl+feide'] as Reach[],
  launched: [false, true],
});
type Cell = (typeof cells)[number];

/** The matrix of spec 01 H5P-006, one permission row at a time, as the spec and PROD-004/006 read. */
function expected(c: Cell): boolean {
  const account = c.view === 'account';
  const ownerOrCoAuthor = c.relation !== 'other';
  const published = c.status === 'published';
  const visible =
    c.role === 'admin' ||
    ownerOrCoAuthor ||
    (c.visibility === 'organisation' && c.reach.includes('hvl')) ||
    (c.visibility === 'feide' && c.reach.includes('feide'));
  switch (c.permission) {
    case Create:
    case List:
      return account && c.role !== 'learner';
    case View:
      if (c.role === 'admin') return true;
      // D-060: an author's own launch (e.g. after a course copy) reveals a published activity, as for learners.
      if (c.role === 'author') return ownerOrCoAuthor || (published && (visible || c.launched));
      return published && (visible || c.launched);
    case Edit:
    case Delete:
    case Download:
      return account && (c.role === 'admin' || (c.role === 'author' && ownerOrCoAuthor));
    default:
      return false;
  }
}

const actorFor = (c: Pick<Cell, 'role' | 'reach' | 'launched'>): HvlH5pActor => ({
  accountId: ME,
  role: c.role,
  learnerKey: 'my-learner-key',
  contextId: 'course-1',
  locale: 'nn',
  hvlMember: c.reach.includes('hvl'),
  feideAuthenticated: c.reach.includes('feide'),
  ltiLaunchContentIds: c.launched ? [CONTENT_ID] : [],
});

const factsFor = (c: Pick<Cell, 'relation' | 'status' | 'visibility'>): ContentFacts => ({
  contentId: CONTENT_ID,
  ownerUserId: c.relation === 'owner' ? ME : SOMEONE_ELSE,
  coAuthorIds: c.relation === 'co-author' ? [SOMEONE_ELSE, ME] : [SOMEONE_ELSE],
  status: c.status,
  visibility: c.visibility,
});

async function check(cell: Cell, facts: ContentFacts | undefined): Promise<boolean> {
  const audited: DataSubjectAccess[] = [];
  const system = new HvlPermissionSystem({
    content: { factsFor: async (id) => (id === CONTENT_ID ? facts : undefined) },
    auditor: { recordDataSubjectAccess: async (access) => void audited.push(access) },
  });
  const user = (cell.view === 'account' ? asAccountUser : asStateUser)(actorFor(cell));
  const contentId = cell.permission === Create || cell.permission === List ? undefined : CONTENT_ID;
  const allowed = await system.checkForContent(user, cell.permission, contentId);
  expect(audited).toEqual([]);
  return allowed;
}

const BASE: Cell = {
  role: 'learner',
  permission: View,
  view: 'state',
  relation: 'other',
  status: 'published',
  visibility: 'private',
  reach: 'outsider',
  launched: false,
};
const rows = cells.map((c) => ({ ...c, name: ContentPermission[c.permission], allowed: expected(c) }));

describe('[H5P-006] content permissions: every cell of the matrix', () => {
  it('[H5P-006] the table covers all seven content permissions and every combination', () => {
    expect(new Set(cells.map((c) => c.permission))).toEqual(
      new Set([Create, Delete, Download, Edit, Embed, List, View]),
    );
    expect(rows).toHaveLength(3 * 7 * 2 * 3 * 2 * 3 * 4 * 2);
    expect(rows.filter((r) => r.allowed).length).toBeGreaterThan(0);
  });

  it.each(rows)(
    '[H5P-006] $role ($view view) $name: $relation, $status, $visibility, reach $reach, LTI $launched -> $allowed',
    async (row) => {
      expect(await check(row, factsFor(row))).toBe(row.allowed);
    },
  );

  it.each(product({ role: ROLES, view: VIEWS }))(
    '[H5P-006] $role ($view view) is denied View, Edit, Delete, Download and Embed on unknown content',
    async ({ role, view }) => {
      for (const permission of [View, Edit, Delete, Download, Embed]) {
        expect(await check({ ...BASE, ...EVERYONE, role, view, permission }, undefined)).toBe(false);
      }
    },
  );
});

describe('[H5P-006] content permissions: anchor cells written out by hand', () => {
  const author = { role: 'author', view: 'account', ...EVERYONE } as const;
  it.each<[string, Partial<Cell>, boolean]>([
    ['a learner never sees a draft, even via LTI (PROD-004)', { ...EVERYONE, status: 'draft' }, false],
    ['a learner sees a published activity their LTI launch opened', { launched: true }, true],
    ['a learner without a launch does not see a private activity', { reach: 'hvl+feide' }, false],
    ['HVL without Feide does not reach a Feide activity', { visibility: 'feide', reach: 'hvl' }, false],
    ['an author previews a co-authored draft', { ...author, status: 'draft', relation: 'co-author' }, true],
    ["authors do not see a colleague's draft", { ...author, status: 'draft', visibility: 'feide' }, false],
    ['[LTI-007] an author views a published activity their own launch opened (D-060)', author, true],
    ["an author's launch does not reveal a colleague's draft", { ...author, status: 'draft' }, false],
    ["an author's launch never lets them edit it", { ...author, permission: Edit }, false],
    ["no edits to a colleague's activity", { ...author, permission: Edit, visibility: 'feide' }, false],
    [
      'a co-author may download a draft',
      { ...author, permission: Download, status: 'draft', relation: 'co-author' },
      true,
    ],
    [
      'a learner who owns an activity may not edit it',
      { view: 'account', permission: Edit, relation: 'owner' },
      false,
    ],
    ['an admin views any draft', { role: 'admin', status: 'draft' }, true],
    ['an admin cannot edit through the state view', { role: 'admin', permission: Edit }, false],
    [
      'nobody may embed, not even the admin owner',
      { role: 'admin', view: 'account', permission: Embed, relation: 'owner' },
      false,
    ],
  ])('[H5P-006] %s', async (_title, rest, allowed) => {
    const cell = { ...BASE, ...rest };
    expect(await check(cell, factsFor(cell))).toBe(allowed);
  });
});
