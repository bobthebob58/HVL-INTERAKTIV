/**
 * Integration tests of who may see insight (INS-007 as D-106 amends it), through the four insight routes on
 * PostgreSQL: the owner and a co-author for every context, a Canvas teacher for the launch's course only (also after a
 * course copy), and refusals for another course's teacher, learners, a colleague who may only view, an admin, and
 * nobody signed in.
 *
 * Spec: INS-007, LTI-006, LTI-007
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { describeWithServices, uniqueName } from '../../support/services.js';
import {
  canvasPrincipal,
  openInsightHttpBench,
  portalPrincipal,
  type InsightHttpBench,
} from './support/insightHttpBench.js';

const ROUTES = ['', '/contexts', '/export', '/findings'] as const;
/** A second Canvas (e.g. HVL's test instance), whose course IDs repeat production's (D-103). */
const OTHER_PLATFORM = {
  clientId: '2',
  name: 'Canvas test',
  authenticationEndpoint: 'https://sso.example/auth',
  accessTokenEndpoint: 'https://sso.example/token',
  idTokenValidationMethod: 'JWK_SET',
  idTokenValidationKey: 'https://sso.example/jwks',
  publicKey: 'p',
  privateKeyEncrypted: Buffer.from([1]),
} as const;

describeWithServices('[INS-007] who may see insight', () => {
  let bench: InsightHttpBench;
  const call = (principal: Principal | undefined, route: (typeof ROUTES)[number] = '', query = '') =>
    request(bench.appAs(principal)).get(`/api/content/${bench.contentId}/insight${route}${query}`);
  const course = (contextId: string, roles: Principal['roles'] = ['author'], userId = bench.colleagueId) =>
    canvasPrincipal(userId, { platformId: bench.platformId, contextId, contentId: bench.contentId }, [
      ...roles,
    ]);

  beforeAll(async () => {
    bench = await openInsightHttpBench();
  }, 60_000);
  afterAll(() => bench.close());

  it('[INS-007] the owner and a co-author see the portal’s plays by default and any course the activity is placed in', async () => {
    // Act
    const portal = await call(portalPrincipal(bench.ownerId));
    const courseA = await call(portalPrincipal(bench.ownerId), '', `?context=${bench.fx.courseA}`);
    const courseB = await call(portalPrincipal(bench.coAuthorId), '', `?context=${bench.fx.courseB}`);
    // Assert
    expect([portal.status, courseA.status, courseB.status]).toEqual([200, 200, 200]);
    expect(portal.body.scope.context).toEqual({ key: 'portal', label: null });
    expect(courseA.body.scope.context).toEqual({ key: bench.fx.courseA, label: 'PED101' });
    expect(courseA.body.participation.started).toEqual({ suppressed: false, value: 28 });
    expect(courseB.body.scope.context.key).toBe(bench.fx.courseB);
  });

  it('[INS-007] in the portal a course the activity is not placed in, or a bare course ID, is refused with 400', async () => {
    // Act
    const elsewhere = await call(portalPrincipal(bench.ownerId), '', `?context=${bench.platformId}:C`);
    const bare = await call(portalPrincipal(bench.ownerId), '', '?context=A');
    // Assert
    for (const res of [elsewhere, bare]) {
      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('error.badRequest');
    }
  });

  describe('[LTI-007] in Canvas', () => {
    it('[LTI-007] a teacher who does not own the activity sees the launch’s course, with or without naming it', async () => {
      // Act
      const fixed = await call(course('A'));
      const named = await call(course('A'), '', `?context=${encodeURIComponent(bench.fx.courseA)}`);
      // Assert
      expect([fixed.status, named.status]).toEqual([200, 200]);
      expect(fixed.body.scope.context).toEqual({ key: bench.fx.courseA, label: 'PED101' });
      expect(fixed.body.participation.courseLearners).toEqual({ suppressed: false, value: 40 });
      expect(named.body).toEqual(fixed.body);
    });

    it('[INS-007] the launch fixes the context: the portal or another course is 403, also for the owner', async () => {
      // Act
      const responses = await Promise.all([
        call(course('A'), '', '?context=portal'),
        call(course('A'), '', `?context=${bench.fx.courseB}`),
        call(course('B', ['author'], bench.ownerId), '', `?context=${bench.fx.courseA}`),
      ]);
      const ownerInB = await call(course('B', ['author'], bench.ownerId));
      // Assert
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe('error.forbidden');
      }
      expect(ownerInB.status).toBe(200);
      expect(ownerInB.body.scope.context.key).toBe(bench.fx.courseB);
    });

    it('[INS-007] a teacher of the same course ID on another Canvas gets 403 on every route (D-103)', async () => {
      // Arrange
      const url = `https://${uniqueName('other-canvas')}.example`;
      const other = await bench.db.ltiPlatform.create({
        data: { ...OTHER_PLATFORM, url },
      });
      const teacher = canvasPrincipal(bench.colleagueId, {
        platformId: other.id,
        contextId: 'A',
        contentId: bench.contentId,
      });
      // Act
      const responses = await Promise.all(ROUTES.map((route) => call(teacher, route)));
      await bench.db.ltiPlatform.delete({ where: { id: other.id } });
      // Assert
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe('error.forbidden');
      }
    });

    it('[INS-007] the contexts in Canvas are the launch’s course alone; in the portal all of them, with labels and no counts', async () => {
      // Act
      const inCanvas = await call(course('A'), '/contexts');
      const inPortal = await call(portalPrincipal(bench.ownerId), '/contexts');
      // Assert
      expect(inCanvas.body).toEqual({ contexts: [{ key: bench.fx.courseA, label: 'PED101' }] });
      expect(inPortal.body).toEqual({
        contexts: [
          { key: 'portal', label: null },
          { key: bench.fx.courseA, label: 'PED101' },
          { key: bench.fx.courseB, label: null },
        ],
      });
    });
  });

  it('[INS-007] another course’s teacher, learners, a colleague who may only view and an admin get 403 on every route', async () => {
    // Arrange
    const refused: [string, Principal][] = [
      ['teacher of a course the activity is not placed in', course('C')],
      ['Canvas learner', course('A', ['learner'])],
      ['portal learner', portalPrincipal(bench.colleagueId, ['learner'])],
      ['colleague who may view', portalPrincipal(bench.colleagueId)],
      ['admin who neither owns nor co-authors', portalPrincipal(bench.adminId, ['author', 'admin'])],
    ];
    // Act and assert
    for (const [who, principal] of refused) {
      for (const route of ROUTES) {
        const res = await call(principal, route);
        expect(res.status, `${who} ${route}`).toBe(403);
        expect(res.body.errorCode, `${who} ${route}`).toBe('error.forbidden');
      }
    }
  });

  it('[INS-007] an unknown, malformed or invisible activity is 404 as if unknown; nobody signed in is 401', async () => {
    // Arrange
    const draft = await bench.db.h5PContent.create({
      data: {
        mainLibrary: 'H5P.MultiChoice',
        title: 'Utkast',
        params: {},
        metadata: {},
        ownerUserId: bench.ownerId,
      },
    });
    const path = (id: string) => `/api/content/${id}/insight`;
    // Act
    const unknown = await request(bench.appAs(portalPrincipal(bench.ownerId))).get(path(crypto.randomUUID()));
    const malformed = await request(bench.appAs(portalPrincipal(bench.ownerId))).get(path('not-a-uuid'));
    const invisible = await request(bench.appAs(portalPrincipal(bench.colleagueId))).get(path(draft.id));
    const nobody = await call(undefined);
    await bench.db.h5PContent.delete({ where: { id: draft.id } });
    // Assert
    for (const res of [unknown, malformed, invisible]) {
      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('hvl:activity-unavailable');
    }
    expect(nobody.status).toBe(401);
  });

  it('[INS-007] an upper-case ID names the same activity; the view and its audit event carry the stored ID', async () => {
    // Arrange
    await bench.db.auditEvent.deleteMany({ where: { actorUserId: bench.ownerId } });
    // Act
    const res = await request(bench.appAs(portalPrincipal(bench.ownerId))).get(
      `/api/content/${bench.contentId.toUpperCase()}/insight`,
    );
    const events = await bench.db.auditEvent.findMany({
      where: { actorUserId: bench.ownerId, action: 'insight.view' },
      select: { targetId: true },
    });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.scope.contentId).toBe(bench.contentId);
    expect(events).toEqual([{ targetId: bench.contentId }]);
  });
});
