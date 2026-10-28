/**
 * Table-driven test of the PROD-007 duplicate rule (D-092): every role x view x relation x status x visibility x
 * reach x LTI launch x bank listing, against the rule as D-092 states it, plus hand-written anchor rows.
 *
 * Spec: PROD-007, H5P-006
 */
import { describe, expect, it } from 'vitest';
import { asAccountUser, asStateUser, type HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import type {
  ContentFacts,
  ContentStatus,
  ContentVisibility,
} from '../../../src/h5p/permissions/ContentAccessRepository.js';
import {
  decideDuplicate,
  mayDuplicate,
  type DuplicateDecision,
} from '../../../src/learningDesign/collaboration/duplicateRules.js';
import { product, ROLES, VIEWS } from '../../h5p/permissions/matrixDimensions.js';

const CONTENT_ID = '0192f0c4-0000-7000-8000-00000000d001';
const ME = '0192f0c4-0000-7000-8000-000000000001';
const SOMEONE_ELSE = '0192f0c4-0000-7000-8000-000000000002';

type Relation = 'owner' | 'co-author' | 'other';
type Reach = 'outsider' | 'hvl' | 'feide';

const cells = product({
  role: ROLES,
  view: VIEWS,
  relation: ['owner', 'co-author', 'other'] as Relation[],
  status: ['draft', 'published'] as ContentStatus[],
  visibility: ['private', 'organisation', 'feide'] as ContentVisibility[],
  reach: ['outsider', 'hvl', 'feide'] as Reach[],
  launched: [false, true],
  bankListed: [false, true],
});
type Cell = (typeof cells)[number];

/** D-092 read literally: View decides "available"; Create, then Edit or (published AND bank-listed) decide the rest. */
function expected(c: Cell): DuplicateDecision['kind'] | 'allowed:edit' | 'allowed:bank' {
  const account = c.view === 'account';
  const ownerOrCoAuthor = c.relation !== 'other';
  const published = c.status === 'published';
  const visible =
    ownerOrCoAuthor ||
    (c.visibility === 'organisation' && c.reach === 'hvl') ||
    (c.visibility === 'feide' && c.reach === 'feide');
  const mayView =
    c.role === 'admin' || (c.role === 'author' && ownerOrCoAuthor) || (published && (visible || c.launched));
  if (!mayView) return 'unavailable';
  if (!account || c.role === 'learner') return 'refused';
  if (c.role === 'admin' || ownerOrCoAuthor) return 'allowed:edit';
  return published && c.bankListed ? 'allowed:bank' : 'refused';
}

const actorFor = (c: Pick<Cell, 'role' | 'reach' | 'launched'>): HvlH5pActor => ({
  accountId: ME,
  role: c.role,
  learnerKey: 'my-learner-key',
  contextId: c.launched ? 'course-1' : '',
  locale: 'nn',
  hvlMember: c.reach === 'hvl',
  feideAuthenticated: c.reach === 'feide',
  ltiLaunchContentIds: c.launched ? [CONTENT_ID] : [],
});

const factsFor = (c: Pick<Cell, 'relation' | 'status' | 'visibility' | 'bankListed'>): ContentFacts => ({
  contentId: CONTENT_ID,
  ownerUserId: c.relation === 'owner' ? ME : SOMEONE_ELSE,
  coAuthorIds: c.relation === 'co-author' ? [SOMEONE_ELSE, ME] : [SOMEONE_ELSE],
  status: c.status,
  visibility: c.visibility,
  bankListed: c.bankListed,
});

const userFor = (c: Cell) => (c.view === 'account' ? asAccountUser : asStateUser)(actorFor(c));

const decide = (c: Cell): string => {
  const decision = decideDuplicate(userFor(c), factsFor(c));
  return decision.kind === 'allowed' ? `allowed:${decision.via}` : decision.kind;
};

const rows = cells.map((c) => ({ ...c, outcome: expected(c) }));

const BASE: Cell = {
  role: 'author',
  view: 'account',
  relation: 'other',
  status: 'published',
  visibility: 'organisation',
  reach: 'hvl',
  launched: false,
  bankListed: true,
};

describe('[PROD-007] duplicate rule: every cell', () => {
  it('[PROD-007] the table covers every combination and reaches all four outcomes', () => {
    expect(rows).toHaveLength(3 * 2 * 3 * 2 * 3 * 3 * 2 * 2);
    expect(new Set(rows.map((r) => r.outcome))).toEqual(
      new Set(['unavailable', 'refused', 'allowed:edit', 'allowed:bank']),
    );
  });

  it.each(rows)(
    '[PROD-007] $role ($view view): $relation, $status, $visibility, reach $reach, LTI $launched, bank $bankListed -> $outcome',
    (row) => {
      expect(decide(row)).toBe(row.outcome);
      expect(mayDuplicate(userFor(row), factsFor(row))).toBe(row.outcome.startsWith('allowed'));
    },
  );

  it.each(product({ role: ROLES, view: VIEWS }))(
    '[PROD-007] $role ($view view): unknown content is unavailable, never refused',
    ({ role, view }) => {
      const user = (view === 'account' ? asAccountUser : asStateUser)(actorFor({ ...BASE, role }));
      expect(decideDuplicate(user, undefined)).toEqual({ kind: 'unavailable' });
    },
  );
});

describe('[PROD-007] duplicate rule: anchor cells written out by hand', () => {
  it.each<[string, Partial<Cell>, string]>([
    ['a colleague copies a published, bank-listed activity shared with HVL', {}, 'allowed:bank'],
    ['a colleague may not copy one shared with HVL but not in the bank', { bankListed: false }, 'refused'],
    ['a bank listing on a draft does not reach a colleague', { status: 'draft' }, 'unavailable'],
    [
      'a private, bank-listed activity stays out of a colleague’s reach',
      { visibility: 'private' },
      'unavailable',
    ],
    ['the owner copies their own draft through Edit', { relation: 'owner', status: 'draft' }, 'allowed:edit'],
    [
      'a co-author copies through Edit, bank or not',
      { relation: 'co-author', bankListed: false },
      'allowed:edit',
    ],
    ['an admin copies anything through Edit', { role: 'admin', visibility: 'private' }, 'allowed:edit'],
    ['a learner may view but never copy', { role: 'learner' }, 'refused'],
    ['the player’s state view never copies', { view: 'state' }, 'refused'],
    [
      'a Canvas author copies a bank activity their launch opened',
      { reach: 'outsider', launched: true },
      'allowed:bank',
    ],
  ])('[PROD-007] %s', (_name, change, outcome) => {
    expect(decide({ ...BASE, ...change })).toBe(outcome);
  });
});
