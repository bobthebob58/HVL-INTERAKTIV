/**
 * Integration tests for the assembled app: headers on every response, the health check, the keyset, the start and
 * 404 pages, and the sharing API reached with each kind of credential.
 *
 * Spec: NFR-002, LTI-001, AUTH-003, PROD-004, PROD-006
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { identitySource } from '../../src/auth/identity/subjectSources.js';
import { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { loginWithFeide } from '../support/feideTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';
import { portalPageCsp } from '../../src/http/pages/portalPages.js';

describeWithServices('The assembled app', () => {
  let tb: AppTestbed;
  let cookie: string;
  let csrf: string;
  let portalUser: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
    const hashes = new IdentityHasher(tb.env.IDENTITY_HASH_KEYS).candidates(
      'identity-subject',
      identitySource({ kind: 'feide', feideId: 'author@hvl.no' }),
    );
    const identity = await tb.db.identity.findFirst({
      where: { subjectHash: { in: hashes.map((c) => c.hash) } },
    });
    portalUser = identity?.userId ?? '';
  }, 60_000);
  afterAll(() => tb.close());

  describe('every response', () => {
    it('[NFR-002] /healthz answers 200 while PostgreSQL and Redis answer', async () => {
      const res = await request(tb.app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('[LTI-003] carries nosniff and no-referrer, and never names the framework', async () => {
      for (const path of ['/healthz', '/', '/no-such-page', '/lti/keys']) {
        const res = await request(tb.app).get(path);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['referrer-policy']).toBe('no-referrer');
        expect(res.headers['x-powered-by']).toBeUndefined();
      }
    });

    it('[LTI-001] /lti/keys publishes the platform key under the platform ID', async () => {
      const res = await request(tb.app).get('/lti/keys');
      expect(res.status).toBe(200);
      expect((res.body.keys as { kid: string }[]).map((key) => key.kid)).toContain(tb.platformId);
    });
  });

  describe('pages', () => {
    it('[PROD-004] an unknown path gets the HTML 404 page, framed only by our own origin and loading only our own files (DATA-011)', async () => {
      const res = await request(tb.app).get('/no-such-page');
      expect(res.status).toBe(404);
      expect(res.type).toBe('text/html');
      expect(res.headers['content-security-policy']).toBe(portalPageCsp());
    });

    it('[AUTH-003] a logout form that is too large or in another charset gets a 4xx page, not a server error', async () => {
      // Act
      const large = await request(tb.app)
        .post('/auth/logout')
        .type('form')
        .send({ csrf: 'x'.repeat(3000) });
      const charset = await request(tb.app)
        .post('/auth/logout')
        .set('Content-Type', 'application/x-www-form-urlencoded; charset=koi8-r')
        .send('csrf=x');
      // Assert
      expect(large.status).toBe(413);
      expect(charset.status).toBe(415);
      expect(large.type).toBe('text/html');
    });

    it('[AUTH-003] the start page offers Feide login without a session, and a CSRF-protected logout with one', async () => {
      const signedOut = await request(tb.app).get('/');
      const signedIn = await request(tb.app).get('/').set('Cookie', cookie);
      expect(signedOut.text).toContain('href="/auth/feide/login"');
      expect(signedIn.text).toContain('action="/auth/logout"');
      expect(signedIn.text).toContain(`name="csrf" value="${csrf}"`);
      expect(signedIn.headers['cache-control']).toBe('no-store');
    });
  });

  describe('the sharing API', () => {
    const share = (id: string) =>
      request(tb.app).patch(`/api/content/${id}/sharing`).send({ visibility: 'feide' });

    it('[PROD-006] the portal owner shares with the CSRF token; without it the change is refused', async () => {
      // Arrange
      const id = await tb.activity(portalUser, { published: true });
      // Act
      const refused = await share(id).set('Cookie', cookie);
      const shared = await share(id).set('Cookie', cookie).set('x-csrf-token', csrf);
      // Assert
      expect(refused.status).toBe(401);
      expect(shared.status).toBe(200);
      expect((await tb.db.h5PContent.findUnique({ where: { id } }))?.visibility).toBe('feide');
    });

    it('[PROD-006] in Canvas the owner shares with the ltik as a Bearer token', async () => {
      // Arrange: the teacher's first launch makes their account; they own an activity
      const first = await launchFromCanvas(tb.app, tb.mock.canvas, {
        messageType: 'LtiDeepLinkingRequest',
        user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
      });
      const { principal } = await tb.lti.resolveLtik(first.ltik ?? '');
      const id = await tb.activity(principal.userId, { published: true });
      // Act
      const res = await share(id).set('Authorization', `Bearer ${first.ltik ?? ''}`);
      // Assert
      expect(res.status).toBe(200);
    });

    it('[PROD-006] without any credential the API answers 401, and an unknown API path 404 as JSON', async () => {
      const id = await tb.activity(portalUser, { published: true });
      expect((await share(id)).status).toBe(401);
      const unknown = await request(tb.app).get('/api/nothing-here').set('Cookie', cookie);
      expect(unknown.status).toBe(404);
      expect(unknown.type).toBe('application/json');
    });
  });
});
