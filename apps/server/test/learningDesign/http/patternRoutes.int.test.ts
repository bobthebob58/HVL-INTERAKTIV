/**
 * Integration tests for who may call `POST /api/patterns/:patternId/activities` (D-085, D-089): the permission
 * matrix on the `/api` router with injected principals and the real studio services, offering the fixture pattern.
 * The testbed has no H5P engine, so each allowed principal is shown to pass the sign-in check by a refusal the
 * creator makes before it would save (a choice the pattern does not offer, an unknown pattern, a malformed body).
 * Creating on the real content types is tested in ../patterns/patternCreation.int.test.ts.
 *
 * Spec: PROD-001, AUTH-003
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Principal, Role } from '../../../src/auth/Principal.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import {
  FIXTURE_PATTERN_ID,
  fixturePatterns,
  studioContentWithPatterns,
} from '../../support/fixturePattern.js';
import { describeWithServices } from '../../support/services.js';

const PATH = `/api/patterns/${FIXTURE_PATTERN_ID}/activities`;
// WHY: `underveis` is not one of the fixture's phases, so an allowed principal is refused before any save.
const NOT_OFFERED = { language: 'nn', contentType: 'H5P.QuestionSet', phase: 'underveis' } as const;

const LTI_LAUNCH: Principal['lti'] = {
  platformId: '00000000-0000-4000-8000-000000000001',
  deploymentId: 'deployment-1',
  contextId: 'course-1',
  messageType: 'LtiDeepLinkingRequest',
};

/** Each kind of caller, how the testbed makes them, and the answer the route gives. */
const MATRIX: readonly {
  readonly who: string;
  readonly role?: Role;
  readonly overrides?: Partial<Principal>;
  readonly status: number;
  readonly errorCode: string;
}[] = [
  { who: 'nobody signed in', status: 401, errorCode: 'hvl:unauthenticated' },
  {
    who: 'an author launched from Canvas (ltik)',
    role: 'author',
    overrides: { mode: 'lti', hvlMember: false, feideAuthenticated: false, lti: LTI_LAUNCH },
    status: 401,
    errorCode: 'hvl:unauthenticated',
  },
  { who: 'a portal learner', role: 'learner', status: 403, errorCode: 'error.forbidden' },
  { who: 'a portal author', role: 'author', status: 400, errorCode: 'hvl:pattern-choice-invalid' },
  {
    who: 'a student author',
    role: 'author',
    overrides: { studentAuthor: true },
    status: 400,
    errorCode: 'hvl:pattern-choice-invalid',
  },
  { who: 'a portal admin', role: 'admin', status: 400, errorCode: 'hvl:pattern-choice-invalid' },
];

describeWithServices('[PROD-001] who may create an activity from a pattern', () => {
  const tb = openApiTestbed({ studioContent: studioContentWithPatterns(fixturePatterns()) });
  const callers = new Map<string, TestPrincipal | undefined>();
  const post = (who: string, body: object, path = PATH) => {
    const caller = callers.get(who);
    const req = request(tb.app).post(path);
    return (caller ? req.set(...caller.header) : req).send(body);
  };
  const created = () =>
    tb.db.h5PContent.count({
      where: { ownerUserId: { in: [...callers.values()].flatMap((c) => (c ? [c.principal.userId] : [])) } },
    });

  beforeAll(async () => {
    for (const row of MATRIX)
      callers.set(row.who, row.role ? await tb.principal(row.role, row.overrides) : undefined);
  });
  afterAll(() => tb.close());

  describe('[PROD-001] the permission matrix', () => {
    it.each(MATRIX)('[PROD-001] $who: $status $errorCode', async ({ who, status, errorCode }) => {
      // Act
      const res = await post(who, NOT_OFFERED);
      // Assert
      expect([res.status, res.body.errorCode]).toEqual([status, errorCode]);
    });
  });

  it('[AUTH-003] checks who is asking before the body, so a refused caller learns nothing from a 400', async () => {
    // Arrange
    const malformed = { language: 'se', colour: 'blue' };
    // Act
    const learner = await post('a portal learner', malformed);
    const canvas = await post('an author launched from Canvas (ltik)', malformed);
    const author = await post('a portal author', malformed);
    // Assert
    expect([learner.status, learner.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect([canvas.status, canvas.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
    expect([author.status, author.body.errorCode]).toEqual([400, 'error.badRequest']);
  });

  it('[PROD-001] answers 404 for a pattern that is not in the content, a malformed ID alike, and creates nothing', async () => {
    // Act
    const unknown = await post(
      'a portal author',
      { language: 'nn' },
      '/api/patterns/no-such-pattern/activities',
    );
    const malformedId = await post(
      'a portal author',
      { language: 'nn' },
      '/api/patterns/Not_An_ID/activities',
    );
    // Assert
    expect([unknown.status, unknown.body.errorCode]).toEqual([404, 'error.notFound']);
    expect([malformedId.status, malformedId.body.errorCode]).toEqual([404, 'error.notFound']);
    expect(await created()).toBe(0);
  });
});
