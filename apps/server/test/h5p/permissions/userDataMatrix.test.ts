/**
 * Table-driven test of the H5P-006 matrix for learner state, through HvlPermissionSystem with an in-memory
 * repository and a recording auditor: every role x user-data permission x whose state x data-subject request
 * x view x relation x status x visibility x LTI launch, plus unknown activities.
 *
 * Spec: H5P-006, DATA-002, DATA-008
 */
import { describe, expect, it } from 'vitest';
import { UserDataPermission } from '@lumieducation/h5p-server';
import { HvlPermissionSystem } from '../../../src/h5p/HvlPermissionSystem.js';
import { asAccountUser, asStateUser, type HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import type {
  ContentFacts,
  ContentStatus,
  ContentVisibility,
} from '../../../src/h5p/permissions/ContentAccessRepository.js';
import type { DataSubjectAccess } from '../../../src/h5p/permissions/UserDataAccessAuditor.js';
import { numeric, product, ROLES, VIEWS } from './matrixDimensions.js';

const CONTENT_ID = '0192f0c4-0000-7000-8000-00000000c001';
const ME = '0192f0c4-0000-7000-8000-000000000001';
const SOMEONE_ELSE = '0192f0c4-0000-7000-8000-000000000002';
/** Whose state is asked for: mine, the learner my data-subject request names, another learner, everyone. */
const KEYS = {
  own: 'my-learner-key',
  named: 'named-learner-key',
  unnamed: 'other-learner-key',
  all: undefined,
};
const REQUEST = { requestId: 'DSR-2026-0001', learnerKey: KEYS.named };
const { EditState, DeleteState, ViewState, ListStates, ViewFinished } = UserDataPermission;
const STATE = [EditState, DeleteState, ViewState, ListStates];

type Relation = 'owner' | 'co-author' | 'other';

const access = {
  role: ROLES,
  permission: numeric(UserDataPermission),
  whose: ['own', 'named', 'unnamed', 'all'] as (keyof typeof KEYS)[],
  request: [false, true],
  view: VIEWS,
};
const activity = {
  relation: ['owner', 'co-author', 'other'] as Relation[],
  status: ['draft', 'published'] as ContentStatus[],
  visibility: ['private', 'organisation', 'feide'] as ContentVisibility[],
  launched: [false, true],
};
const cells = product({ ...access, ...activity });
type Cell = (typeof cells)[number];
type AccessCell = Pick<Cell, keyof typeof access>;

/** View on the activity (H5P-006) for an actor who is an HVL member without a Feide login. */
function canView(c: Cell): boolean {
  const ownerOrCoAuthor = c.relation !== 'other';
  const published = c.status === 'published';
  const visible = ownerOrCoAuthor || c.visibility === 'organisation';
  if (c.role === 'admin') return true;
  // D-060: an author's own launch (e.g. after a course copy) reveals a published activity, as for learners.
  if (c.role === 'author') return ownerOrCoAuthor || (published && (visible || c.launched));
  return published && (visible || c.launched);
}

/** H5P-006: own state (state view, may view the activity) or a data-subject request (admin, audited). */
function expected(c: AccessCell, viewable: boolean): { allowed: boolean; audited: boolean } {
  const state = STATE.includes(c.permission);
  const own = state && c.whose === 'own' && c.view === 'state' && viewable;
  const subjectRequest = state && c.whose === 'named' && c.role === 'admin' && c.request;
  return { allowed: own || subjectRequest, audited: subjectRequest };
}

const actorFor = (c: AccessCell & { launched: boolean }): HvlH5pActor => ({
  accountId: ME,
  role: c.role,
  learnerKey: KEYS.own,
  contextId: 'course-1',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: false,
  studentAuthor: false,
  ltiLaunchContentIds: c.launched ? [CONTENT_ID] : [],
  ...(c.request ? { dataSubjectRequest: REQUEST } : {}),
});

const factsFor = (c: Cell): ContentFacts => ({
  contentId: CONTENT_ID,
  ownerUserId: c.relation === 'owner' ? ME : SOMEONE_ELSE,
  coAuthorIds: c.relation === 'co-author' ? [SOMEONE_ELSE, ME] : [SOMEONE_ELSE],
  status: c.status,
  visibility: c.visibility,
  bankListed: false,
});

/** Runs one check against an in-memory repository and returns the decision and what was audited. */
async function check(c: AccessCell & { launched: boolean }, facts: ContentFacts | undefined) {
  const audited: DataSubjectAccess[] = [];
  const system = new HvlPermissionSystem({
    content: { factsFor: async (id) => (id === CONTENT_ID ? facts : undefined) },
    auditor: { recordDataSubjectAccess: async (record) => void audited.push(record) },
  });
  const user = (c.view === 'account' ? asAccountUser : asStateUser)(actorFor(c));
  const allowed = await system.checkForUserData(user, c.permission, CONTENT_ID, KEYS[c.whose]);
  return { allowed, audited };
}

const auditRecord = (permission: UserDataPermission): DataSubjectAccess => ({
  actorUserId: ME,
  request: REQUEST,
  contentId: CONTENT_ID,
  permission,
});

const rows = cells.map((c) => ({ ...c, name: UserDataPermission[c.permission], ...expected(c, canView(c)) }));
const unknownRows = product(access).map((c) => ({
  ...c,
  name: UserDataPermission[c.permission],
  ...expected(c, false),
}));

describe('[H5P-006] user-data permissions: every cell of the matrix', () => {
  it('[H5P-006] the table covers all seven user-data permissions and every combination', () => {
    expect(new Set(cells.map((c) => c.permission)).size).toBe(7);
    expect(rows).toHaveLength(3 * 7 * 4 * 2 * 2 * (3 * 2 * 3 * 2));
    expect(rows.filter((r) => r.allowed && !r.audited).length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.audited).length).toBeGreaterThan(0);
  });

  it.each(rows)(
    '[H5P-006] $role ($view view, request $request) $name on $whose state: $relation, $status, $visibility, LTI $launched -> $allowed',
    async (row) => {
      const { allowed, audited } = await check(row, factsFor(row));
      expect(allowed).toBe(row.allowed);
      expect(audited).toEqual(row.audited ? [auditRecord(row.permission)] : []);
    },
  );

  it.each(unknownRows)(
    '[H5P-006] $role ($view view, request $request) $name on $whose state of an unknown activity -> $allowed',
    async (row) => {
      const { allowed, audited } = await check({ ...row, launched: true }, undefined);
      expect(allowed).toBe(row.allowed);
      expect(audited).toEqual(row.audited ? [auditRecord(row.permission)] : []);
    },
  );
});

describe('[H5P-006] user-data permissions: anchor cells written out by hand', () => {
  const base = {
    role: 'learner',
    permission: ViewState,
    whose: 'own',
    request: false,
    view: 'state',
  } as const;
  const published = factsFor({
    ...base,
    relation: 'other',
    status: 'published',
    visibility: 'organisation',
    launched: false,
  });
  const dsr = { role: 'admin', whose: 'named', request: true } as const;
  it.each<[string, Partial<AccessCell>, ContentFacts | undefined, boolean]>([
    ['a learner resumes their own state', {}, published, true],
    ['a learner has no state on a draft (PROD-004)', {}, { ...published, status: 'draft' }, false],
    ['the account view never reaches own state (D-036)', { view: 'account' }, published, false],
    ["a learner cannot read another learner's state", { whose: 'unnamed' }, published, false],
    [
      'an author cannot read one learner (aggregates only)',
      { role: 'author', whose: 'unnamed' },
      published,
      false,
    ],
    ['finished data is off, even own (D-037)', { permission: ViewFinished }, published, false],
    ['an admin reads the learner a request names', dsr, published, true],
    ['an admin reads it even for an unknown activity', dsr, undefined, true],
    ['an admin without a request is refused', { ...dsr, request: false }, published, false],
    ['a request never reaches another learner', { ...dsr, whose: 'unnamed' }, published, false],
    ['no one gets every learner at once', { ...dsr, whose: 'all' }, published, false],
  ])('[H5P-006] %s', async (_title, rest, facts, allowed) => {
    expect((await check({ ...base, ...rest, launched: false }, facts)).allowed).toBe(allowed);
  });
});
