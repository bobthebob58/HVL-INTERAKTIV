/**
 * Integration tests for who may read and replace an activity's learning-design metadata (D-087, D-089): the
 * permission matrix of `GET` and `PUT /api/content/:contentId/learning-design` on the `/api` router with injected
 * principals and the real studio services.
 *
 * Spec: PED-030, AUTH-003, H5P-006
 */
import { learningDesignSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { describeWithServices } from '../../support/services.js';
import { LTI_LAUNCH, storeMetadata, type StudioCaller } from './metadataFixtures.js';

/** How the caller relates to the activity the row asks about. */
type Relation = 'owner' | 'coAuthor' | 'viewer' | 'stranger';

/** Each kind of caller, the activity they ask about, and the answer both routes give. */
const MATRIX: readonly (StudioCaller & {
  readonly relation: Relation;
  readonly status: number;
  readonly errorCode?: string;
})[] = [
  { who: 'nobody signed in', relation: 'viewer', status: 401, errorCode: 'hvl:unauthenticated' },
  {
    who: 'the owner, launched from Canvas (ltik)',
    role: 'author',
    overrides: { mode: 'lti', hvlMember: false, feideAuthenticated: false, lti: LTI_LAUNCH },
    relation: 'owner',
    status: 401,
    errorCode: 'hvl:unauthenticated',
  },
  {
    who: 'a portal learner who may view it',
    role: 'learner',
    relation: 'viewer',
    status: 403,
    errorCode: 'error.forbidden',
  },
  {
    who: 'a colleague who may only view it',
    role: 'author',
    relation: 'viewer',
    status: 403,
    errorCode: 'hvl:edit-not-allowed',
  },
  {
    who: 'an author who may not view it',
    role: 'author',
    relation: 'stranger',
    status: 404,
    errorCode: 'hvl:activity-unavailable',
  },
  { who: 'the owner', role: 'author', relation: 'owner', status: 200 },
  { who: 'a co-author', role: 'author', relation: 'coAuthor', status: 200 },
  {
    who: 'a student author who owns it',
    role: 'author',
    overrides: { studentAuthor: true },
    relation: 'owner',
    status: 200,
  },
  { who: 'an admin', role: 'admin', relation: 'stranger', status: 200 },
];

describeWithServices('[PED-030] who may read and replace the learning-design metadata', () => {
  const tb = openApiTestbed();
  const callers = new Map<string, TestPrincipal | undefined>();
  const activities = new Map<string, string>();
  const path = (who: string) => `/api/content/${activities.get(who) ?? ''}/learning-design`;
  const call = (who: string, method: 'get' | 'put', body?: object) => {
    const caller = callers.get(who);
    const req = request(tb.app)[method](path(who));
    return (caller ? req.set(...caller.header) : req).send(body);
  };

  beforeAll(async () => {
    const colleague = await tb.principal('author');
    for (const row of MATRIX) {
      const caller = row.role ? await tb.principal(row.role, row.overrides) : undefined;
      callers.set(row.who, caller);
      const id = caller?.principal.userId;
      const contentId =
        row.relation === 'owner' && id
          ? await tb.content(id)
          : row.relation === 'coAuthor' && id
            ? await tb.content(colleague.principal.userId, { coAuthors: [id] })
            : row.relation === 'viewer'
              ? await tb.content(colleague.principal.userId, {
                  status: 'published',
                  visibility: 'organisation',
                })
              : await tb.content(colleague.principal.userId);
      activities.set(row.who, contentId);
    }
  });
  afterAll(() => tb.close());

  describe('[PED-030] GET', () => {
    it.each(MATRIX)('[PED-030] $who: $status', async ({ who, status, errorCode }) => {
      // Act
      const res = await call(who, 'get');
      // Assert
      expect(res.status).toBe(status);
      if (errorCode) expect(res.body.errorCode).toBe(errorCode);
      else expect(learningDesignSchema.parse(res.body)).toEqual({ outcomes: [], updatedAt: null });
    });
  });

  describe('[PED-030] PUT', () => {
    it.each(MATRIX)(
      '[PED-030] $who: $status, and a refusal stores nothing',
      async ({ who, status, errorCode }) => {
        // Arrange
        const body = { updatedAt: null, outcomes: [], phase: 'forarbeid', rationale: 'Fordi.' };
        // Act
        const res = await call(who, 'put', body);
        const stored = await tb.db.learningDesignMetadata.count({
          where: { contentId: activities.get(who) },
        });
        // Assert
        expect(res.status).toBe(status);
        if (errorCode) {
          expect(res.body.errorCode).toBe(errorCode);
          expect(stored).toBe(0);
        } else {
          expect(learningDesignSchema.parse(res.body)).toMatchObject({
            phase: 'forarbeid',
            rationale: 'Fordi.',
          });
          expect(stored).toBe(1);
        }
      },
    );
  });

  it('[AUTH-003] checks who asks and the Edit right before the body, so a refused caller learns nothing from a 400', async () => {
    // Arrange
    const malformed = { colour: 'blue' };
    // Act
    const viewer = await call('a colleague who may only view it', 'put', malformed);
    const learner = await call('a portal learner who may view it', 'put', malformed);
    const owner = await call('the owner', 'put', malformed);
    // Assert
    expect([viewer.status, viewer.body.errorCode]).toEqual([403, 'hvl:edit-not-allowed']);
    expect([learner.status, learner.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect([owner.status, owner.body.errorCode]).toEqual([400, 'error.badRequest']);
  });

  it('[PED-030] a viewer never gets the rationale, even once it is stored', async () => {
    // Arrange
    const contentId = activities.get('a colleague who may only view it') ?? '';
    await storeMetadata(tb.db, contentId, { rationale: 'Berre for forfattaren', phase: 'underveis' });
    const learnerHeader = callers.get('a portal learner who may view it')?.header ?? ['', ''];
    // Act
    const viewer = await call('a colleague who may only view it', 'get');
    // WHY: the learner asks about the same published activity that holds the rationale.
    const learner = await request(tb.app)
      .get(`/api/content/${contentId}/learning-design`)
      .set(...learnerHeader);
    // Assert
    for (const res of [viewer, learner]) {
      expect(res.status).toBe(403);
      expect(res.text).not.toContain('Berre for forfattaren');
    }
  });

  it('[PED-030] an unknown or malformed activity ID is answered like one the person may not view', async () => {
    // Arrange
    const owner = callers.get('the owner');
    // Act
    const unknown = await request(tb.app)
      .get(`/api/content/${crypto.randomUUID()}/learning-design`)
      .set(...(owner?.header ?? ['', '']));
    const malformed = await request(tb.app)
      .get('/api/content/not-an-id/learning-design')
      .set(...(owner?.header ?? ['', '']));
    // Assert
    for (const res of [unknown, malformed]) {
      expect([res.status, res.body.errorCode]).toEqual([404, 'hvl:activity-unavailable']);
    }
  });
});
